#!/usr/bin/env bash
# Ponta a ponta das Edge Functions — V2 passo 1 (coordenação × voluntário).
# Cria usuários e pets de teste (*-e2e@teste.local, "E2E *") e REMOVE tudo no
# final (trap EXIT), mesmo se algum passo falhar.
set -uo pipefail
cd "$(dirname "$0")/../.."

REF=$(cat supabase/.temp/project-ref)
API="https://$REF.supabase.co"
ANON=$(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY .env.local | cut -d= -f2)
SERVICE=$(supabase projects api-keys --project-ref $REF -o json 2>/dev/null | jq -r '.[] | select(.name == "service_role") | .api_key')
REDIRECT="http://localhost:3000/painel/definir-senha"

falhas=0
checar() { if [[ "$2" == "$3" ]]; then echo "ok      $1"; else echo "FALHOU  $1 (obtido: $2, esperado: $3)"; falhas=$((falhas + 1)); fi; }
svc() { curl -s -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" "$@"; }
login() { curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.access_token // empty'; }
funcao() { curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$API/functions/v1/$1" -H "apikey: $ANON" \
  ${2:+-H "Authorization: Bearer $2"} -H "Content-Type: application/json" -d "$3"; }
id_usuario() { svc "$API/auth/v1/admin/users?per_page=1000" | jq -r --arg e "$1" '.users[] | select(.email == $e) | .id'; }
perfil_de() { svc "$API/rest/v1/perfil?email=eq.$1&select=papel,ong_id,funcao" | jq -r '.[0] | "\(.papel)/\(.ong_id)/\(.funcao)"'; }
cria_usuario() { # email senha papel ong funcao
  local id; id=$(svc -X POST "$API/auth/v1/admin/users" -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true}" | jq -r .id)
  local ong=${4:-null} fn=${5:+\"$5\"}; fn=${fn:-null}
  svc -X POST "$API/rest/v1/perfil" -d "{\"user_id\":\"$id\",\"papel\":\"$3\",\"ong_id\":$ong,\"funcao\":$fn,\"email\":\"$1\"}" >/dev/null
}
entra_pelo_link() { # link senha -> token
  local th; th=$(sed -E 's/.*token_hash=([^&]+).*/\1/' <<<"$1"); local tipo; tipo=$(sed -E 's/.*type=([a-z]+).*/\1/' <<<"$1")
  local s; s=$(curl -s -X POST "$API/auth/v1/verify" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"type\":\"$tipo\",\"token_hash\":\"$th\"}" | jq -r '.access_token // empty')
  curl -s -o /dev/null -X PUT "$API/auth/v1/user" -H "apikey: $ANON" -H "Authorization: Bearer $s" -H "Content-Type: application/json" -d "{\"password\":\"$2\"}"
}

limpar() {
  svc -X DELETE "$API/rest/v1/animal?nome=like.E2E*" >/dev/null
  for id in $(svc "$API/auth/v1/admin/users?per_page=1000" | jq -r '.users[] | select(.email | test("-e2e@teste\\.local$")) | .id'); do
    svc -X DELETE "$API/auth/v1/admin/users/$id" >/dev/null
  done
  echo "--- limpeza"
  echo "usuários de teste restantes: $(svc "$API/auth/v1/admin/users?per_page=1000" | jq '[.users[] | select(.email | test("teste\\.local$"))] | length')"
  echo "pets de teste restantes: $(svc "$API/rest/v1/animal?nome=like.E2E*&select=id" | jq length)"
  echo "$falhas falha(s)"
}
trap limpar EXIT
[[ ${#SERVICE} -gt 50 ]] || { echo "sem service key"; exit 1; }

PATA=$(svc "$API/rest/v1/ong?slug=eq.pata-amada&select=id" | jq -r '.[0].id')
SOS=$(svc "$API/rest/v1/ong?slug=eq.sos-pet-pinheiro&select=id" | jq -r '.[0].id')
novo_pet() { svc -H "Prefer: return=representation" -X POST "$API/rest/v1/animal" -d "{\"ong_id\":$1,\"nome\":\"$2\",\"especie\":\"gato\",\"sexo\":\"macho\",\"porte\":\"pequeno\",\"idade\":\"1\"}" | jq -r '.[0].id'; }
PET_PATA=$(novo_pet $PATA "E2E Pata"); PET_SOS=$(novo_pet $SOS "E2E SOS")

cria_usuario admin-e2e@teste.local senha-e2e-admin-1 admin
cria_usuario coord-e2e@teste.local senha-e2e-coord-1 ong $PATA coordenacao
cria_usuario sos-e2e@teste.local senha-e2e-sos-1 ong $SOS voluntario
ADMIN=$(login admin-e2e@teste.local senha-e2e-admin-1)
COORD=$(login coord-e2e@teste.local senha-e2e-coord-1)
checar "logins de teste" "$([[ ${#ADMIN} -gt 50 && ${#COORD} -gt 50 ]] && echo sim)" "sim"

echo "== coordenação convida"
st=$(funcao convidar "$COORD" "{\"acao\":\"convidar\",\"email\":\"vol-e2e@teste.local\",\"nome\":\"Vol\",\"papel\":\"admin\",\"ong_id\":$SOS,\"redirect_to\":\"$REDIRECT\"}")
LINK_VOL=$(jq -r '.link // .error' /tmp/resp.json)
checar "coordenação convida voluntário" "$st" "200"
checar "papel/ONG forçados: voluntário da própria ONG (ignora papel=admin e ong_id=SOS)" "$(perfil_de vol-e2e@teste.local)" "ong/$PATA/voluntario"
st=$(funcao convidar "$COORD" "{\"acao\":\"convidar\",\"email\":\"admin-e2e@teste.local\",\"redirect_to\":\"$REDIRECT\"}")
checar "coordenação NÃO gera link para e-mail de admin (tomada de conta)" "$st" "403"
st=$(funcao convidar "$COORD" "{\"acao\":\"convidar\",\"email\":\"sos-e2e@teste.local\",\"redirect_to\":\"$REDIRECT\"}")
checar "coordenação NÃO gera link para pessoa de outra ONG" "$st" "403"
checar "perfil do admin intacto" "$(perfil_de admin-e2e@teste.local)" "admin/null/null"

echo "== voluntário"
entra_pelo_link "$LINK_VOL" senha-e2e-vol-1
VOL=$(login vol-e2e@teste.local senha-e2e-vol-1)
checar "voluntário entra pelo link" "$([[ ${#VOL} -gt 50 ]] && echo sim)" "sim"
st=$(funcao convidar "$VOL" "{\"acao\":\"convidar\",\"email\":\"x-e2e@teste.local\",\"redirect_to\":\"$REDIRECT\"}")
checar "voluntário NÃO convida" "$st" "403"
st=$(funcao cloudinary "$VOL" "{\"acao\":\"apagar_animal\",\"animal_id\":$PET_PATA}")
checar "voluntário NÃO apaga pet (Edge Function)" "$st" "403"
st=$(funcao cloudinary "$VOL" "{\"acao\":\"assinar_logo\",\"ong_id\":$PATA}")
checar "voluntário NÃO troca logo" "$st" "403"
st=$(funcao cloudinary "$VOL" "{\"acao\":\"assinar_foto\",\"animal_id\":$PET_PATA}")
checar "voluntário envia foto de pet da ONG" "$st" "200"

echo "== funções na equipe"
VOL_ID=$(id_usuario vol-e2e@teste.local); COORD_ID=$(id_usuario coord-e2e@teste.local); SOS_ID=$(id_usuario sos-e2e@teste.local); ADMIN_ID=$(id_usuario admin-e2e@teste.local)
st=$(funcao convidar "$COORD" "{\"acao\":\"definir_funcao\",\"user_id\":\"$VOL_ID\",\"funcao\":\"coordenacao\"}")
checar "coordenação promove voluntário" "$st/$(perfil_de vol-e2e@teste.local)" "200/ong/$PATA/coordenacao"
st=$(funcao convidar "$COORD" "{\"acao\":\"definir_funcao\",\"user_id\":\"$VOL_ID\",\"funcao\":\"voluntario\"}")
checar "coordenação NÃO rebaixa outra coordenação" "$st" "403"
st=$(funcao convidar "$ADMIN" "{\"acao\":\"definir_funcao\",\"user_id\":\"$VOL_ID\",\"funcao\":\"voluntario\"}")
checar "admin rebaixa (restam 1 coordenação)" "$st" "200"
st=$(funcao convidar "$ADMIN" "{\"acao\":\"definir_funcao\",\"user_id\":\"$COORD_ID\",\"funcao\":\"voluntario\"}")
checar "NÃO rebaixa a última coordenação" "$st" "400"

echo "== remoção"
st=$(funcao convidar "$COORD" "{\"acao\":\"remover\",\"user_id\":\"$ADMIN_ID\"}")
checar "coordenação NÃO remove admin" "$st" "403"
st=$(funcao convidar "$COORD" "{\"acao\":\"remover\",\"user_id\":\"$SOS_ID\"}")
checar "coordenação NÃO remove pessoa de outra ONG" "$st" "403"
st=$(funcao convidar "$COORD" "{\"acao\":\"remover\",\"user_id\":\"$VOL_ID\"}")
checar "coordenação remove voluntário da própria ONG" "$st" "200"

echo "== exclusão de pet"
st=$(funcao cloudinary "$COORD" "{\"acao\":\"apagar_animal\",\"animal_id\":$PET_SOS}")
checar "coordenação NÃO apaga pet de outra ONG" "$st" "403"
st=$(funcao cloudinary "$COORD" "{\"acao\":\"apagar_animal\",\"animal_id\":$PET_PATA}")
checar "coordenação apaga pet da própria ONG" "$st" "200"
