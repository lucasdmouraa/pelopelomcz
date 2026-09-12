-- V2, passo 1: papéis dentro da ONG (coordenação × voluntário) e censo.
--
-- Coordenação: tudo da própria ONG, inclusive a equipe (Edge Function convidar).
-- Voluntário: rotina de cuidado. Não vê pedidos de adoção (CPF), não edita a
-- ONG, não apaga animais nem muda a situação deles.

-- ---------------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------------

alter table public.perfil add column funcao text
  check (funcao in ('coordenacao', 'voluntario'));

-- quem já usava o painel pela ONG tinha acesso total: vira coordenação
update public.perfil set funcao = 'coordenacao' where papel = 'ong';

alter table public.perfil add constraint perfil_funcao_obrigatoria
  check ((papel = 'ong') = (funcao is not null));

create function private.sou_coordenacao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfil
    where user_id = (select auth.uid()) and papel = 'ong' and funcao = 'coordenacao'
  );
$$;

grant execute on function private.sou_coordenacao() to anon, authenticated;

-- perfil: a equipe da ONG se enxerga (tela Equipe, "quem deu a dose")
drop policy "perfil: o próprio ou o admin lê" on public.perfil;
create policy "perfil: o próprio, a equipe da ONG e o admin leem" on public.perfil
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.eh_admin())
  or (ong_id is not null and ong_id = (select private.minha_ong()))
);

-- ong: só a coordenação edita o perfil da própria ONG
drop policy "ong: admin ou a própria ONG edita" on public.ong;
create policy "ong: admin ou a coordenação da ONG edita" on public.ong
for update to authenticated
using ((select private.eh_admin()) or (id = (select private.minha_ong()) and (select private.sou_coordenacao())))
with check ((select private.eh_admin()) or (id = (select private.minha_ong()) and (select private.sou_coordenacao())));

-- pedidos de adoção (CPF): só a coordenação da ONG do pet e o admin
drop policy "pedido: ONG do pet e admin leem" on public.adoption_request;
create policy "pedido: coordenação da ONG do pet e admin leem" on public.adoption_request
for select to authenticated
using (
  (select private.eh_admin())
  or (
    (select private.sou_coordenacao())
    and exists (select 1 from public.animal a where a.id = pet_id and a.ong_id = (select private.minha_ong()))
  )
);

drop policy "pedido: ONG do pet e admin acompanham" on public.adoption_request;
create policy "pedido: coordenação da ONG do pet e admin acompanham" on public.adoption_request
for update to authenticated
using (
  (select private.eh_admin())
  or (
    (select private.sou_coordenacao())
    and exists (select 1 from public.animal a where a.id = pet_id and a.ong_id = (select private.minha_ong()))
  )
);

-- animal: só a coordenação apaga (a Edge Function cloudinary também confere)
drop policy "animal: ONG remove os seus" on public.animal;
create policy "animal: coordenação da ONG remove" on public.animal
for delete to authenticated
using ((select private.eh_admin()) or (ong_id = (select private.minha_ong()) and (select private.sou_coordenacao())));

-- ---------------------------------------------------------------------------
-- Censo
-- ---------------------------------------------------------------------------

-- Situações que se excluem. "Em tratamento" e "lar temporário" são derivados
-- de outras tabelas (e o endereço de um lar nunca pode ficar em `animal`,
-- cuja linha é pública quando o pet está disponível).
alter table public.animal drop constraint animal_status_check;
alter table public.animal add constraint animal_status_check
  check (status in ('em_avaliacao', 'disponivel', 'em_processo', 'adotado', 'morador', 'falecido'));
alter table public.animal alter column status set default 'em_avaliacao';

-- permite FKs compostas (animal_id, ong_id) nas tabelas filhas
alter table public.animal add constraint animal_id_ong_unique unique (id, ong_id);

-- Voluntário cadastra e edita pets, mas a situação é decisão da coordenação:
-- o que ele cadastra nasce "em avaliação" e mudança de status é recusada.
create function private.animal_regras_da_equipe()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or private.eh_admin() or private.sou_coordenacao() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'em_avaliacao';
  elsif new.status is distinct from old.status then
    raise exception 'Apenas a coordenação da ONG pode mudar a situação do pet';
  end if;
  return new;
end;
$$;

create trigger animal_regras_da_equipe
before insert or update on public.animal
for each row execute function private.animal_regras_da_equipe();

-- Autoria e ONG das tabelas filhas: a ONG vem sempre do animal (o cliente não
-- escolhe) e o nome de quem registrou sobrevive à remoção do usuário.
create function private.preencher_ong_e_autor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select a.ong_id into new.ong_id from public.animal a where a.id = new.animal_id;
  new.registrado_por := (select auth.uid());
  new.registrado_por_nome := (
    select coalesce(p.nome, p.email) from public.perfil p where p.user_id = (select auth.uid())
  );
  new.registrado_em := now();
  return new;
end;
$$;

-- Ficha interna do animal (1:1), invisível para o público
create table public.animal_ficha (
  animal_id bigint primary key,
  ong_id bigint not null,
  data_entrada date,
  origem_resgate text,
  condicao_chegada text,
  microchip text,
  nascimento_aproximado date,
  observacoes text,
  data_obito date,
  causa_obito text,
  registrado_em timestamptz not null default now(),
  registrado_por uuid references auth.users (id) on delete set null,
  registrado_por_nome text,
  foreign key (animal_id, ong_id) references public.animal (id, ong_id)
    on update cascade on delete cascade
);

create trigger animal_ficha_autoria
before insert or update on public.animal_ficha
for each row execute function private.preencher_ong_e_autor();

alter table public.animal_ficha enable row level security;
revoke all on public.animal_ficha from anon;

create policy "ficha: equipe da ONG e admin" on public.animal_ficha
for all to authenticated
using (ong_id = (select private.minha_ong()) or (select private.eh_admin()))
with check (ong_id = (select private.minha_ong()) or (select private.eh_admin()));
