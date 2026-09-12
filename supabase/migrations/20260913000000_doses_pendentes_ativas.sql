-- Correção: a tela "Hoje" mostrava como atrasada a dose pendente de um pet que
-- acabou de ser adotado ou faleceu (e de tratamentos encerrados no meio do
-- dia): o horário ainda caía dentro do período do tratamento. Agora doses
-- PENDENTES só aparecem para tratamentos ativos de pets sob cuidado; as doses
-- já registradas continuam aparecendo no histórico.
create or replace function public.doses_previstas(de timestamptz, ate timestamptz, p_animal bigint default null)
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
    and (
      d.id is not null
      or ((hr.fim is null or hr.fim > now()) and a.status not in ('adotado', 'falecido'))
    )
  order by hr.previsto, a.nome;
$$;
