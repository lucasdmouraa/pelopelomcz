-- PeloPelo Maceió — schema inicial
--
-- Papéis: "admin" (gestão geral) e "ong" (cada ONG gerencia a própria vitrine).
-- Toda a segurança está nas políticas RLS: o front (site e painel) usa só a
-- chave pública. Operações que precisam de segredo (Cloudinary, convites)
-- passam pelas Edge Functions em supabase/functions.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.ong (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null,
  descricao text,
  logo_url text,
  instagram text,
  site text,
  whatsapp text,
  email text,
  ativa boolean not null default true
);

create type public.papel as enum ('admin', 'ong');

create table public.perfil (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  papel public.papel not null,
  ong_id bigint references public.ong (id) on delete cascade,
  nome text,
  email text,
  constraint perfil_ong_obrigatoria check ((papel = 'ong') = (ong_id is not null))
);
create index perfil_ong_id_idx on public.perfil (ong_id);

create table public.animal (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ong_id bigint not null references public.ong (id) on delete restrict,
  -- preenchido por trigger ("nome-id") e nunca alterado: é a URL /adote/[slug]
  slug text not null unique,
  nome text not null,
  especie text not null check (especie in ('gato', 'cachorro')),
  sexo text not null check (sexo in ('macho', 'femea')),
  porte text not null check (porte in ('pequeno', 'medio', 'grande', 'gigante')),
  idade text not null,
  descricao text,
  vacinado boolean not null default false,
  vermifugado boolean not null default false,
  castrado boolean not null default false,
  especial boolean not null default false,
  status text not null default 'disponivel'
    check (status in ('disponivel', 'em_processo', 'adotado'))
);
create index animal_ong_id_idx on public.animal (ong_id);

create table public.foto (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  animal_id bigint not null references public.animal (id) on delete cascade,
  public_id text not null unique,
  ordem int not null default 0,
  -- a Edge Function só assina uploads dentro da pasta do próprio animal
  constraint foto_pasta_do_animal check (public_id like 'pets/' || animal_id || '/%')
);
create index foto_animal_id_idx on public.foto (animal_id, ordem);

create table public.adoption_request (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null,
  cpf text not null,
  pet_id bigint not null references public.animal (id) on delete cascade,
  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'concluido', 'recusado')),
  observacao text
);
create index adoption_request_pet_id_idx on public.adoption_request (pet_id);

create table public.votes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  option int not null check (option between 1 and 5)
);

create table public.newsletter (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null
);

-- Uma linha só: controla quando o site estático precisa ser reconstruído.
create table public.site_estado (
  id int primary key default 1 check (id = 1),
  alterado_em timestamptz,
  publicado_em timestamptz
);
insert into public.site_estado (id) values (1);

-- ---------------------------------------------------------------------------
-- Funções auxiliares das políticas
-- ---------------------------------------------------------------------------

create function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfil
    where user_id = (select auth.uid()) and papel = 'admin'
  );
$$;

create function public.minha_ong()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select ong_id from public.perfil where user_id = (select auth.uid());
$$;

create function public.slugify(texto text)
returns text
language sql
stable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(texto)), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.animal_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.slug := coalesce(nullif(public.slugify(new.nome), ''), 'pet') || '-' || new.id;
  else
    -- URL estável: links já compartilhados continuam funcionando após renomear
    new.slug := old.slug;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger animal_antes_de_gravar
before insert or update on public.animal
for each row execute function public.animal_antes_de_gravar();

create function public.ong_antes_de_atualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- a própria ONG edita o perfil, mas não o slug nem a situação (ativa)
  if current_user = 'authenticated'
    and not public.eh_admin()
    and (new.slug is distinct from old.slug or new.ativa is distinct from old.ativa)
  then
    raise exception 'Apenas o administrador pode alterar o slug ou a situação da ONG';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger ong_antes_de_atualizar
before update on public.ong
for each row execute function public.ong_antes_de_atualizar();

create function public.marcar_site_alterado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.site_estado set alterado_em = now() where id = 1;
  return null;
end;
$$;

create trigger animal_altera_site
after insert or update or delete on public.animal
for each statement execute function public.marcar_site_alterado();

create trigger foto_altera_site
after insert or update or delete on public.foto
for each statement execute function public.marcar_site_alterado();

create trigger ong_altera_site
after insert or update or delete on public.ong
for each statement execute function public.marcar_site_alterado();

-- ---------------------------------------------------------------------------
-- Publicação automática do site (Cloudflare Pages deploy hook)
--
-- O site é export estático: pets novos só aparecem após um build. A cada 5 min
-- o pg_cron verifica se houve alteração; espera 3 min sem mudanças (agrupa uma
-- sessão de edição num build só) e no máximo 1 build a cada 10 min.
-- A URL do deploy hook fica no Vault:
--   select vault.create_secret('<url do deploy hook>', 'deploy_hook_url');
-- Sem o segredo, nada é disparado.
-- ---------------------------------------------------------------------------

create function public.publicar_site(forcar boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  estado public.site_estado;
  hook text;
begin
  select * into estado from public.site_estado where id = 1 for update;

  if not forcar and (
    estado.alterado_em is null
    or estado.alterado_em <= coalesce(estado.publicado_em, '-infinity')
    or estado.alterado_em > now() - interval '3 minutes'
    or coalesce(estado.publicado_em, '-infinity') > now() - interval '10 minutes'
  ) then
    return false;
  end if;

  select decrypted_secret into hook
  from vault.decrypted_secrets
  where name = 'deploy_hook_url';

  if hook is null then
    return false;
  end if;

  perform net.http_post(url := hook);
  update public.site_estado set publicado_em = now() where id = 1;
  return true;
end;
$$;

create function public.publicar_agora()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Apenas administradores podem publicar manualmente';
  end if;
  return public.publicar_site(forcar => true);
end;
$$;

revoke execute on function public.publicar_site(boolean) from public, anon, authenticated;
revoke execute on function public.publicar_agora() from public, anon;
grant execute on function public.publicar_agora() to authenticated;

select cron.schedule('publicar-site', '*/5 * * * *', $$select public.publicar_site()$$);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ong enable row level security;
alter table public.perfil enable row level security;
alter table public.animal enable row level security;
alter table public.foto enable row level security;
alter table public.adoption_request enable row level security;
alter table public.votes enable row level security;
alter table public.newsletter enable row level security;
alter table public.site_estado enable row level security;

-- ong
create policy "ong: ativas são públicas" on public.ong
for select to anon, authenticated
using (ativa or id = (select public.minha_ong()) or (select public.eh_admin()));

create policy "ong: admin cadastra" on public.ong
for insert to authenticated
with check ((select public.eh_admin()));

create policy "ong: admin ou a própria ONG edita" on public.ong
for update to authenticated
using ((select public.eh_admin()) or id = (select public.minha_ong()))
with check ((select public.eh_admin()) or id = (select public.minha_ong()));

create policy "ong: admin remove" on public.ong
for delete to authenticated
using ((select public.eh_admin()));

-- perfil (escrita só pelo admin; convites usam a service role na Edge Function)
create policy "perfil: o próprio ou o admin lê" on public.perfil
for select to authenticated
using (user_id = (select auth.uid()) or (select public.eh_admin()));

create policy "perfil: admin gerencia" on public.perfil
for all to authenticated
using ((select public.eh_admin()))
with check ((select public.eh_admin()));

-- animal
create policy "animal: vitrine pública e gestão" on public.animal
for select to anon, authenticated
using (
  (status = 'disponivel' and exists (select 1 from public.ong o where o.id = ong_id and o.ativa))
  or ong_id = (select public.minha_ong())
  or (select public.eh_admin())
);

create policy "animal: ONG cadastra os seus" on public.animal
for insert to authenticated
with check (ong_id = (select public.minha_ong()) or (select public.eh_admin()));

create policy "animal: ONG edita os seus" on public.animal
for update to authenticated
using (ong_id = (select public.minha_ong()) or (select public.eh_admin()))
with check (ong_id = (select public.minha_ong()) or (select public.eh_admin()));

create policy "animal: ONG remove os seus" on public.animal
for delete to authenticated
using (ong_id = (select public.minha_ong()) or (select public.eh_admin()));

-- foto (visibilidade herdada do animal)
create policy "foto: segue o animal" on public.foto
for select to anon, authenticated
using (exists (select 1 from public.animal a where a.id = animal_id));

create policy "foto: ONG gerencia as dos seus pets" on public.foto
for all to authenticated
using (exists (
  select 1 from public.animal a
  where a.id = animal_id and (a.ong_id = (select public.minha_ong()) or (select public.eh_admin()))
))
with check (exists (
  select 1 from public.animal a
  where a.id = animal_id and (a.ong_id = (select public.minha_ong()) or (select public.eh_admin()))
));

-- adoption_request (contém CPF: só a ONG do pet e o admin leem — LGPD)
create policy "pedido: qualquer um envia para pet disponível" on public.adoption_request
for insert to anon, authenticated
with check (
  status = 'novo'
  and observacao is null
  and exists (select 1 from public.animal a where a.id = pet_id and a.status = 'disponivel')
);

create policy "pedido: ONG do pet e admin leem" on public.adoption_request
for select to authenticated
using (
  (select public.eh_admin())
  or exists (select 1 from public.animal a where a.id = pet_id and a.ong_id = (select public.minha_ong()))
);

create policy "pedido: ONG do pet e admin acompanham" on public.adoption_request
for update to authenticated
using (
  (select public.eh_admin())
  or exists (select 1 from public.animal a where a.id = pet_id and a.ong_id = (select public.minha_ong()))
);

create policy "pedido: admin remove" on public.adoption_request
for delete to authenticated
using ((select public.eh_admin()));

-- a ONG só muda o andamento do pedido, nunca os dados do interessado
revoke update on public.adoption_request from anon, authenticated;
grant update (status, observacao) on public.adoption_request to authenticated;

-- votes / newsletter
create policy "votes: qualquer um vota" on public.votes
for insert to anon, authenticated
with check (true);

create policy "votes: admin lê" on public.votes
for select to authenticated
using ((select public.eh_admin()));

create policy "newsletter: qualquer um se inscreve" on public.newsletter
for insert to anon, authenticated
with check (true);

create policy "newsletter: admin lê" on public.newsletter
for select to authenticated
using ((select public.eh_admin()));

-- site_estado
create policy "site_estado: painel lê" on public.site_estado
for select to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- ONGs parceiras iniciais (logos em /public)
-- ---------------------------------------------------------------------------

insert into public.ong (slug, nome, logo_url, instagram, site) values
  ('pata-amada', 'Grupo Pata Amada', '/pata-amada.png',
   'https://www.instagram.com/grupopataamada/', 'https://x.com/grupopataamada'),
  ('sos-pet-pinheiro', 'SOS Pet Pinheiro', '/sos-pet-pinheiro.png',
   'https://www.instagram.com/sospetpinheiro/', 'https://www.atados.com.br/ong/sos-pet-pinheiro-323931'),
  ('projeto-acolher', 'Projeto Acolher Maceió', '/projeto-acolher.png',
   'https://www.instagram.com/projetoacolher/', 'https://adotar.com.br/instituicao/projeto-acolher');
