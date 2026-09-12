-- Tira do alcance da API REST as funções SECURITY DEFINER que só servem às
-- políticas RLS e aos triggers (aviso "security_definer_function_executable"
-- da checagem de segurança do Supabase). O schema `private` não é exposto pelo
-- PostgREST; anon/authenticated mantêm EXECUTE porque as políticas são
-- avaliadas com o papel de quem consulta.
--
-- ALTER FUNCTION ... SET SCHEMA preserva o OID: políticas e triggers continuam
-- apontando para as mesmas funções. Só os corpos que as chamam pelo nome
-- precisam ser recriados.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.eh_admin() set schema private;
alter function public.minha_ong() set schema private;
alter function public.marcar_site_alterado() set schema private;

grant execute on function private.eh_admin(), private.minha_ong() to anon, authenticated;

-- trigger dispara sem precisar de EXECUTE
revoke execute on function private.marcar_site_alterado() from public, anon, authenticated;

create or replace function public.ong_antes_de_atualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- a própria ONG edita o perfil, mas não o slug nem a situação (ativa)
  if current_user = 'authenticated'
    and not private.eh_admin()
    and (new.slug is distinct from old.slug or new.ativa is distinct from old.ativa)
  then
    raise exception 'Apenas o administrador pode alterar o slug ou a situação da ONG';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Continua em public de propósito: o botão "Publicar agora" do painel a chama
-- via RPC. É SECURITY DEFINER para poder disparar publicar_site() (que ninguém
-- da API executa) e só age se quem chama for admin.
create or replace function public.publicar_agora()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.eh_admin() then
    raise exception 'Apenas administradores podem publicar manualmente';
  end if;
  return public.publicar_site(forcar => true);
end;
$$;
