-- V2, passo 3: prontuário (linha do tempo de saúde de cada animal).
--
-- Vacinas, vermífugos, antipulgas, consultas, exames, cirurgias e peso, com
-- "próxima data" (reforço/retorno) que vira lembrete até ser resolvido.
-- Registrar um novo evento do mesmo tipo (e produto) resolve o lembrete
-- anterior do mesmo animal.

create table public.evento_saude (
  id bigint generated always as identity primary key,
  animal_id bigint not null,
  ong_id bigint not null,
  tipo text not null check (tipo in (
    'vacina', 'vermifugo', 'antipulgas', 'consulta', 'exame', 'cirurgia', 'castracao', 'peso', 'outro'
  )),
  data date not null default current_date,
  produto text,
  descricao text,
  peso_kg numeric(5, 2) check (peso_kg > 0),
  proxima_data date,
  lembrete_resolvido boolean not null default false,
  valor numeric(10, 2) check (valor >= 0),
  registrado_em timestamptz not null default now(),
  registrado_por uuid references auth.users (id) on delete set null,
  registrado_por_nome text,
  constraint evento_peso_informado check (tipo <> 'peso' or peso_kg is not null),
  foreign key (animal_id, ong_id) references public.animal (id, ong_id)
    on update cascade on delete cascade
);

create index evento_saude_animal_idx on public.evento_saude (animal_id, data desc);
create index evento_saude_lembretes_idx on public.evento_saude (ong_id, proxima_data)
  where proxima_data is not null and not lembrete_resolvido;

-- ONG e autor vêm do banco, não do cliente (só na criação: o autor original
-- continua registrado mesmo que alguém corrija o evento depois)
create trigger evento_saude_autoria
before insert on public.evento_saude
for each row execute function private.preencher_ong_e_autor();

-- Novo evento do mesmo tipo (e mesmo produto, se informado) resolve os
-- lembretes anteriores do animal: aplicou o reforço, o aviso some.
create function private.resolver_lembretes_anteriores()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.evento_saude e
  set lembrete_resolvido = true
  where e.animal_id = new.animal_id
    and e.tipo = new.tipo
    and e.id <> new.id
    and e.proxima_data is not null
    and not e.lembrete_resolvido
    and e.data <= new.data
    and (new.produto is null or e.produto is null or lower(e.produto) = lower(new.produto));
  return null;
end;
$$;

create trigger evento_saude_resolve_anteriores
after insert on public.evento_saude
for each row execute function private.resolver_lembretes_anteriores();

grant execute on function private.resolver_lembretes_anteriores() to service_role;

alter table public.evento_saude enable row level security;
revoke all on public.evento_saude from anon;

create policy "saude: equipe da ONG e admin leem" on public.evento_saude
for select to authenticated
using (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

create policy "saude: equipe da ONG registra" on public.evento_saude
for insert to authenticated
with check (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

create policy "saude: equipe da ONG corrige" on public.evento_saude
for update to authenticated
using (ong_id = (select private.minha_ong()) or (select private.eh_admin()))
with check (ong_id = (select private.minha_ong()) or (select private.eh_admin()));

-- apagar: quem registrou, a coordenação da ONG ou o admin
create policy "saude: autor ou coordenação apaga" on public.evento_saude
for delete to authenticated
using (
  (select private.eh_admin())
  or (
    ong_id = (select private.minha_ong())
    and (registrado_por = (select auth.uid()) or (select private.sou_coordenacao()))
  )
);

-- Lembretes pendentes até `ate` (inclui vencidos). INVOKER: a RLS limita à
-- ONG de quem chama. Animais adotados ou falecidos não geram aviso.
create function public.vencimentos(ate date default (current_date + 7))
returns table (
  id bigint,
  animal_id bigint,
  animal_nome text,
  tipo text,
  produto text,
  proxima_data date,
  data date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.animal_id, a.nome, e.tipo, e.produto, e.proxima_data, e.data
  from public.evento_saude e
  join public.animal a on a.id = e.animal_id
  where e.proxima_data is not null
    and not e.lembrete_resolvido
    and e.proxima_data <= ate
    and a.status not in ('adotado', 'falecido')
  order by e.proxima_data, a.nome;
$$;

revoke execute on function public.vencimentos(date) from public, anon;
grant execute on function public.vencimentos(date) to authenticated;
