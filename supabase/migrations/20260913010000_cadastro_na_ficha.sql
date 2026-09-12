-- Linha do tempo do pet: "cadastrado em ... por ...".
--
-- Quem cadastrou o pet NÃO pode ficar em `animal` (a linha de um pet
-- disponível é pública e exporia o nome de quem trabalha na ONG). Fica na
-- ficha interna, criada automaticamente junto com o pet, com o usuário logado
-- como autor — e não pode ser alterada pelo painel depois.

-- 1. Autoria vinda do usuário logado só quando quem grava é o painel; gravações
--    do backend (service role, SQL do admin) mantêm os valores informados.
create or replace function private.preencher_ong_e_autor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select a.ong_id into new.ong_id from public.animal a where a.id = new.animal_id;
  if current_user = 'authenticated' then
    new.registrado_por := (select auth.uid());
    new.registrado_por_nome := (
      select coalesce(p.nome, p.email) from public.perfil p where p.user_id = (select auth.uid())
    );
    new.registrado_em := now();
  end if;
  return new;
end;
$$;

-- 2. Dados do cadastro na ficha
alter table public.animal_ficha
  add column cadastrado_em timestamptz,
  add column cadastrado_por uuid references auth.users (id) on delete set null,
  add column cadastrado_por_nome text;

-- o painel não reescreve quem cadastrou
create function private.ficha_preserva_cadastro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.cadastrado_em := old.cadastrado_em;
    new.cadastrado_por := old.cadastrado_por;
    new.cadastrado_por_nome := old.cadastrado_por_nome;
  end if;
  return new;
end;
$$;

create trigger animal_ficha_preserva_cadastro
before update on public.animal_ficha
for each row execute function private.ficha_preserva_cadastro();

-- 3. Todo pet novo já nasce com a ficha, registrando quem cadastrou
create function private.criar_ficha_do_animal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.animal_ficha (animal_id, cadastrado_em, cadastrado_por, cadastrado_por_nome)
  values (
    new.id,
    new.created_at,
    (select auth.uid()),
    (select coalesce(p.nome, p.email) from public.perfil p where p.user_id = (select auth.uid()))
  )
  on conflict (animal_id) do nothing;
  return null;
end;
$$;

create trigger animal_cria_ficha
after insert on public.animal
for each row execute function private.criar_ficha_do_animal();

grant execute on function private.ficha_preserva_cadastro(), private.criar_ficha_do_animal()
  to service_role;

-- 4. Pets que já existiam: ficha para quem não tinha e data do cadastro para
--    todos (o autor desses fica em branco: não foi registrado na época)
insert into public.animal_ficha (animal_id, cadastrado_em)
select a.id, a.created_at
from public.animal a
where not exists (select 1 from public.animal_ficha f where f.animal_id = a.id);

update public.animal_ficha f
set cadastrado_em = a.created_at
from public.animal a
where a.id = f.animal_id and f.cadastrado_em is null;
