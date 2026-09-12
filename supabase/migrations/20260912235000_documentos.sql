-- V2, passo 6: documentos privados por animal (Supabase Storage).
--
-- Bucket privado `documentos`. Caminho de cada arquivo:
--   ong/<ong_id>/<equipe|restrito>/<animal_id>/<uuid>.<ext>
-- "equipe":   toda a equipe da ONG vê (exames, receitas, carteira de vacinação)
-- "restrito": só a coordenação e o admin (termo de adoção, comprovantes com CPF)
-- Nada é público: o painel abre os arquivos por URL assinada de curta duração.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos', 'documentos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Quem pode ver/enviar um caminho do bucket (usado pelas políticas do Storage)
create function private.pode_acessar_documento(caminho text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (storage.foldername(caminho))[1] = 'ong'
    and (
      private.eh_admin()
      or (
        (storage.foldername(caminho))[2] = private.minha_ong()::text
        and ((storage.foldername(caminho))[3] = 'equipe' or private.sou_coordenacao())
      )
    );
$$;

grant execute on function private.pode_acessar_documento(text) to authenticated, service_role;

create policy "documentos: equipe da ONG lê" on storage.objects
for select to authenticated
using (bucket_id = 'documentos' and private.pode_acessar_documento(name));

create policy "documentos: equipe da ONG envia" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documentos'
  and private.pode_acessar_documento(name)
  and (storage.foldername(name))[3] in ('equipe', 'restrito')
);

create policy "documentos: quem enviou ou a coordenação apaga" on storage.objects
for delete to authenticated
using (
  bucket_id = 'documentos'
  and private.pode_acessar_documento(name)
  and (private.eh_admin() or private.sou_coordenacao() or owner_id = (select auth.uid())::text)
);

-- Registro de cada documento (o que o painel lista)
create table public.documento (
  id bigint generated always as identity primary key,
  animal_id bigint not null,
  ong_id bigint not null,
  tipo text not null check (tipo in (
    'exame', 'receita', 'carteira_vacinacao', 'laudo', 'termo_adocao', 'nota_fiscal', 'outro'
  )),
  nome text not null,
  caminho text not null unique,
  mime text,
  tamanho bigint check (tamanho >= 0),
  restrito boolean not null default false,
  registrado_em timestamptz not null default now(),
  registrado_por uuid references auth.users (id) on delete set null,
  registrado_por_nome text,
  -- o caminho no Storage precisa bater com a ONG, a pasta e o pet do registro
  constraint documento_caminho_coerente check (
    caminho like 'ong/' || ong_id || '/' || (case when restrito then 'restrito' else 'equipe' end)
      || '/' || animal_id || '/%'
  ),
  foreign key (animal_id, ong_id) references public.animal (id, ong_id)
    on update cascade on delete cascade
);

create index documento_animal_idx on public.documento (animal_id, registrado_em desc);

create trigger documento_autoria
before insert on public.documento
for each row execute function private.preencher_ong_e_autor();

alter table public.documento enable row level security;
revoke all on public.documento from anon;
-- não se edita: apaga e envia de novo
revoke update on public.documento from authenticated;

create policy "documento: equipe da ONG lê" on public.documento
for select to authenticated
using (
  (select private.eh_admin())
  or (ong_id = (select private.minha_ong()) and (not restrito or (select private.sou_coordenacao())))
);

create policy "documento: equipe da ONG registra" on public.documento
for insert to authenticated
with check (
  (select private.eh_admin())
  or (ong_id = (select private.minha_ong()) and (not restrito or (select private.sou_coordenacao())))
);

create policy "documento: quem enviou ou a coordenação apaga" on public.documento
for delete to authenticated
using (
  (select private.eh_admin())
  or (
    ong_id = (select private.minha_ong())
    and (not restrito or (select private.sou_coordenacao()))
    and ((select private.sou_coordenacao()) or registrado_por = (select auth.uid()))
  )
);

-- Os arquivos ficam na pasta da ONG: transferir o pet deixaria os documentos
-- para trás (e visíveis para a ONG antiga).
create function private.animal_bloqueia_troca_de_ong()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ong_id is distinct from old.ong_id
    and exists (select 1 from public.documento d where d.animal_id = old.id)
  then
    raise exception 'Este pet tem documentos guardados: não dá para transferir de ONG';
  end if;
  return new;
end;
$$;

create trigger animal_bloqueia_troca_de_ong
before update of ong_id on public.animal
for each row execute function private.animal_bloqueia_troca_de_ong();

grant execute on function private.animal_bloqueia_troca_de_ong() to service_role;
