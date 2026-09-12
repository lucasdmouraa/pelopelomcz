-- Correção: gravações com a service role (Edge Functions, scripts de teste) em
-- `animal` e `ong` falhavam com "permission denied for schema private". Os
-- triggers chamavam private.eh_admin() dentro de condições com OR/AND, e o
-- Postgres não garante a ordem em que avalia os termos: mesmo quando o
-- primeiro termo já resolvia a condição, a função do schema `private` podia
-- ser chamada.

grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

-- Os papéis só são consultados quando quem grava é um usuário do painel.
create or replace function private.animal_regras_da_equipe()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if private.eh_admin() or private.sou_coordenacao() then
    return new;
  end if;

  -- voluntário: o que cadastra nasce "em avaliação" e não muda a situação
  if tg_op = 'INSERT' then
    new.status := 'em_avaliacao';
  elsif new.status is distinct from old.status then
    raise exception 'Apenas a coordenação da ONG pode mudar a situação do pet';
  end if;
  return new;
end;
$$;

create or replace function public.ong_antes_de_atualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- a própria ONG edita o perfil, mas não o slug nem a situação (ativa)
  if current_user = 'authenticated' then
    if not private.eh_admin()
      and (new.slug is distinct from old.slug or new.ativa is distinct from old.ativa)
    then
      raise exception 'Apenas o administrador pode alterar o slug ou a situação da ONG';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
