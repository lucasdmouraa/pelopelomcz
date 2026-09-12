-- V2, passo 4: remédios com horário e checklist de doses.
--
-- Um tratamento tem horários fixos (ex.: 08:00 e 20:00), a cada N dias, de um
-- início até um fim (ou contínuo). As doses previstas são GERADAS na consulta
-- (fuso America/Maceio), não guardadas; só a dose efetivamente dada (ou
-- pulada) vira linha em `dose`, com quem deu e quando.
--
-- Garantias no banco:
-- - dose repetida: unique (tratamento_id, previsto_para);
-- - horário inventado (ex.: 08:00:00.001) ou muito no futuro: recusado;
-- - quem deu: sempre o usuário logado (não dá para registrar em nome de outro);
-- - horários não mudam depois de criados ("Alterar" encerra e cria outro),
--   para as doses já dadas nunca mudarem de horário.

create table public.tratamento (
  id bigint generated always as identity primary key,
  animal_id bigint not null,
  ong_id bigint not null,
  medicamento text not null check (length(trim(medicamento)) > 0),
  dose text,
  via text,
  instrucoes text,
  -- vazio = "se necessário" (só doses avulsas)
  horarios time[] not null default '{}',
  intervalo_dias int not null default 1 check (intervalo_dias between 1 and 90),
  inicio timestamptz not null default now(),
  fim timestamptz,
  substitui_id bigint references public.tratamento (id) on delete set null,
  registrado_em timestamptz not null default now(),
  registrado_por uuid references auth.users (id) on delete set null,
  registrado_por_nome text,
  constraint tratamento_periodo check (fim is null or fim >= inicio),
  foreign key (animal_id, ong_id) references public.animal (id, ong_id)
    on update cascade on delete cascade
);

create index tratamento_animal_idx on public.tratamento (animal_id, inicio desc);
create index tratamento_ativos_idx on public.tratamento (ong_id) where fim is null;

create trigger tratamento_autoria
before insert on public.tratamento
for each row execute function private.preencher_ong_e_autor();

create function private.tratamento_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.medicamento is distinct from old.medicamento
    or new.dose is distinct from old.dose
    or new.via is distinct from old.via
    or new.horarios is distinct from old.horarios
    or new.intervalo_dias is distinct from old.intervalo_dias
    or new.inicio is distinct from old.inicio
    or new.animal_id is distinct from old.animal_id
  then
    raise exception 'Para mudar remédio, dose ou horários, use "Alterar": o tratamento atual é encerrado e um novo começa';
  end if;
  new.registrado_em := old.registrado_em;
  new.registrado_por := old.registrado_por;
  new.registrado_por_nome := old.registrado_por_nome;
  return new;
end;
$$;

create trigger tratamento_imutavel
before update on public.tratamento
for each row execute function private.tratamento_imutavel();

create table public.dose (
  id bigint generated always as identity primary key,
  tratamento_id bigint not null references public.tratamento (id) on delete cascade,
  ong_id bigint not null,
  -- nulo = dose avulsa ("se necessário" ou extra)
  previsto_para timestamptz,
  dada_em timestamptz not null default now(),
  pulada boolean not null default false,
  observacao text,
  registrado_em timestamptz not null default now(),
  dada_por uuid references auth.users (id) on delete set null,
  dada_por_nome text,
  constraint dose_unica unique (tratamento_id, previsto_para)
);

-- O horário pertence à agenda do tratamento?
create function private.eh_horario_previsto(t public.tratamento, ts timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select ts >= t.inicio
    and (t.fim is null or ts < t.fim)
    and (ts at time zone 'America/Maceio')::time = any (t.horarios)
    and ((ts at time zone 'America/Maceio')::date
         - (t.inicio at time zone 'America/Maceio')::date) % t.intervalo_dias = 0;
$$;

grant execute on function private.eh_horario_previsto(public.tratamento, timestamptz)
  to authenticated, service_role;

create function private.dose_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t public.tratamento;
begin
  -- INVOKER: a RLS de `tratamento` esconde tratamentos de outras ONGs
  select * into t from public.tratamento where id = new.tratamento_id;
  if not found then
    raise exception 'Tratamento não encontrado';
  end if;

  new.ong_id := t.ong_id;
  new.registrado_em := now();
  new.dada_por := (select auth.uid());
  new.dada_por_nome := (
    select coalesce(p.nome, p.email) from public.perfil p where p.user_id = (select auth.uid())
  );
  new.dada_em := least(coalesce(new.dada_em, now()), now());

  if new.previsto_para is not null then
    if not private.eh_horario_previsto(t, new.previsto_para) then
      raise exception 'Esse horário não faz parte da agenda do tratamento';
    end if;
    if new.previsto_para > now() + interval '12 hours' then
      raise exception 'Essa dose ainda não está no horário';
    end if;
  end if;
  return new;
end;
$$;

create trigger dose_antes_de_gravar
before insert on public.dose
for each row execute function private.dose_antes_de_gravar();

-- Adotado ou falecido: tratamentos em aberto são encerrados
create function private.encerrar_tratamentos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('adotado', 'falecido') and new.status is distinct from old.status then
    update public.tratamento
    set fim = greatest(now(), inicio)
    where animal_id = new.id and (fim is null or fim > now());
  end if;
  return null;
end;
$$;

create trigger animal_encerra_tratamentos
after update of status on public.animal
for each row execute function private.encerrar_tratamentos();

grant execute on function private.tratamento_imutavel(), private.dose_antes_de_gravar(),
  private.encerrar_tratamentos() to service_role;

-- RLS -----------------------------------------------------------------------

alter table public.tratamento enable row level security;
alter table public.dose enable row level security;
revoke all on public.tratamento from anon;
revoke all on public.dose from anon;
-- dose não se edita: corrige apagando (regra abaixo) e registrando de novo
revoke update on public.dose from authenticated;

create policy "tratamento: equipe da ONG e admin leem" on public.tratamento
for select to authenticated
using (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

create policy "tratamento: equipe da ONG cadastra" on public.tratamento
for insert to authenticated
with check (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

create policy "tratamento: equipe da ONG encerra" on public.tratamento
for update to authenticated
using (ong_id = (select private.minha_ong()) or (select private.eh_admin()))
with check (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

-- apagar some com o histórico de doses: só coordenação e admin
create policy "tratamento: coordenação apaga" on public.tratamento
for delete to authenticated
using ((select private.eh_admin()) or (ong_id = (select private.minha_ong()) and (select private.sou_coordenacao())));

create policy "dose: equipe da ONG e admin leem" on public.dose
for select to authenticated
using (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

create policy "dose: equipe da ONG registra" on public.dose
for insert to authenticated
with check (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

-- desfazer: quem registrou, em até 15 minutos; coordenação e admin a qualquer hora
create policy "dose: desfazer" on public.dose
for delete to authenticated
using (
  (select private.eh_admin())
  or (
    ong_id = (select private.minha_ong())
    and (
      (select private.sou_coordenacao())
      or (dada_por = (select auth.uid()) and registrado_em > now() - interval '15 minutes')
    )
  )
);

-- Agenda ----------------------------------------------------------------------

-- Doses previstas entre `de` e `ate` (opcionalmente de um animal), já com o
-- registro de quem deu. INVOKER: a RLS limita à ONG de quem chama.
create function public.doses_previstas(de timestamptz, ate timestamptz, p_animal bigint default null)
returns table (
  tratamento_id bigint,
  animal_id bigint,
  animal_nome text,
  medicamento text,
  dose text,
  via text,
  instrucoes text,
  previsto_para timestamptz,
  dose_id bigint,
  dada_em timestamptz,
  pulada boolean,
  dada_por uuid,
  dada_por_nome text,
  dose_registrada_em timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with horarios as (
    select t.*, ((dia::date + h) at time zone 'America/Maceio') as previsto
    from public.tratamento t
    cross join lateral generate_series(
      greatest((de at time zone 'America/Maceio')::date, (t.inicio at time zone 'America/Maceio')::date),
      (ate at time zone 'America/Maceio')::date,
      interval '1 day'
    ) as dia
    cross join lateral unnest(t.horarios) as h
    where (p_animal is null or t.animal_id = p_animal)
      and (dia::date - (t.inicio at time zone 'America/Maceio')::date) % t.intervalo_dias = 0
  )
  select hr.id, hr.animal_id, a.nome, hr.medicamento, hr.dose, hr.via, hr.instrucoes, hr.previsto,
         d.id, d.dada_em, d.pulada, d.dada_por, d.dada_por_nome, d.registrado_em
  from horarios hr
  join public.animal a on a.id = hr.animal_id
  left join public.dose d on d.tratamento_id = hr.id and d.previsto_para = hr.previsto
  where hr.previsto >= de
    and hr.previsto < ate
    and hr.previsto >= hr.inicio
    and (hr.fim is null or hr.previsto < hr.fim)
  order by hr.previsto, a.nome;
$$;

revoke execute on function public.doses_previstas(timestamptz, timestamptz, bigint) from public, anon;
grant execute on function public.doses_previstas(timestamptz, timestamptz, bigint) to authenticated;
