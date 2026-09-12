#!/usr/bin/env bash
# Ponta a ponta dos documentos (Supabase Storage de verdade, pela API).
# Cria usuários, um pet e arquivos de teste e REMOVE tudo no final (trap EXIT).
set -uo pipefail
cd "$(dirname "$0")/../.."

REF=$(cat supabase/.temp/project-ref)
API="https://$REF.supabase.co"
ANON=$(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY .env.local | cut -d= -f2)
SERVICE=$(supabase projects api-keys --project-ref $REF -o json 2>/dev/null | jq -r '.[] | select(.name == "service_role") | .api_key')
TMP=$(mktemp -d)

falhas=0
checar() { if [[ "$2" == "$3" ]]; then echo "ok      $1"; else echo "FALHOU  $1 (obtido: $2, esperado: $3)"; falhas=$((falhas + 1)); fi; }
svc() { curl -s -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" "$@"; }
login() { curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.access_token // empty'; }
cria_usuario() { # email senha ong funcao
  local id; id=$(svc -X POST "$API/auth/v1/admin/users" -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true}" | jq -r .id)
  svc -X POST "$API/rest/v1/perfil" -d "{\"user_id\":\"$id\",\"papel\":\"ong\",\"ong_id\":$3,\"funcao\":\"$4\",\"nome\":\"$1\",\"email\":\"$1\"}" >/dev/null
}
envia() { # token caminho arquivo mime -> status
  curl -s -o /tmp/up.json -w "%{http_code}" -X POST "$API/storage/v1/object/documentos/$2" \
    -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: $4" --data-binary "@$3"
}
assina() { # token caminho -> url assinada (ou vazio)
  curl -s -X POST "$API/storage/v1/object/sign/documentos/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" \
    -H "Content-Type: application/json" -d '{"expiresIn":120}' | jq -r '.signedURL // empty'
}
lista() { # prefixo -> quantidade de arquivos (service role)
  svc -X POST "$API/storage/v1/object/list/documentos" -d "{\"prefix\":\"$1\",\"limit\":100}" | jq 'length'
}

limpar() {
  # arquivos que sobrarem sob o pet de teste
  for pasta in equipe restrito; do
    nomes=$(svc -X POST "$API/storage/v1/object/list/documentos" -d "{\"prefix\":\"ong/$PATA/$pasta/${PET:-0}\",\"limit\":100}" | jq -c '[.[]?.name]')
    [[ "$nomes" != "[]" && "$nomes" != "null" ]] && svc -X DELETE "$API/storage/v1/object/documentos" \
      -d "{\"prefixes\":$(jq -c --arg p "ong/$PATA/$pasta/${PET:-0}/" '[.[] | $p + .]' <<<"$nomes")}" >/dev/null
  done
  svc -X DELETE "$API/rest/v1/animal?nome=like.E2E*" >/dev/null
  for id in $(svc "$API/auth/v1/admin/users?per_page=1000" | jq -r '.users[] | select(.email | test("-e2e@teste\\.local$")) | .id'); do
    svc -X DELETE "$API/auth/v1/admin/users/$id" >/dev/null
  done
  rm -rf "$TMP"
  echo "--- limpeza"
  echo "usuários de teste restantes: $(svc "$API/auth/v1/admin/users?per_page=1000" | jq '[.users[] | select(.email | test("teste\\.local$"))] | length')"
  echo "pets de teste restantes: $(svc "$API/rest/v1/animal?nome=like.E2E*&select=id" | jq length)"
  echo "arquivos de teste restantes: $(( $(lista "ong/$PATA/equipe/${PET:-0}") + $(lista "ong/$PATA/restrito/${PET:-0}") ))"
  echo "$falhas falha(s)"
}
trap limpar EXIT
[[ ${#SERVICE} -gt 50 ]] || { echo "sem service key"; exit 1; }

PATA=$(svc "$API/rest/v1/ong?slug=eq.pata-amada&select=id" | jq -r '.[0].id')
SOS=$(svc "$API/rest/v1/ong?slug=eq.sos-pet-pinheiro&select=id" | jq -r '.[0].id')
PET=$(svc -H "Prefer: return=representation" -X POST "$API/rest/v1/animal" -d "{\"ong_id\":$PATA,\"nome\":\"E2E Docs\",\"especie\":\"gato\",\"sexo\":\"macho\",\"porte\":\"pequeno\",\"idade\":\"1\"}" | jq -r '.[0].id')
cria_usuario coord-e2e@teste.local senha-e2e-coord-1 $PATA coordenacao
cria_usuario vol-e2e@teste.local senha-e2e-vol-1 $PATA voluntario
cria_usuario sos-e2e@teste.local senha-e2e-sos-1 $SOS coordenacao
COORD=$(login coord-e2e@teste.local senha-e2e-coord-1)
VOL=$(login vol-e2e@teste.local senha-e2e-vol-1)
SOSU=$(login sos-e2e@teste.local senha-e2e-sos-1)
checar "pet e logins de teste" "$([[ $PET =~ ^[0-9]+$ && ${#COORD} -gt 50 && ${#VOL} -gt 50 && ${#SOSU} -gt 50 ]] && echo sim)" "sim"

printf '%%PDF-1.4\n%% documento de teste do PeloPelo\n' > "$TMP/exame.pdf"
printf 'texto' > "$TMP/nota.txt"
head -c $((6 * 1024 * 1024)) /dev/zero > "$TMP/grande.pdf"
EQUIPE="ong/$PATA/equipe/$PET/$(uuidgen | tr A-Z a-z).pdf"
RESTRITO="ong/$PATA/restrito/$PET/$(uuidgen | tr A-Z a-z).pdf"

echo "== envio"
checar "voluntário envia exame (pasta da equipe)" "$(envia "$VOL" "$EQUIPE" "$TMP/exame.pdf" application/pdf)" "200"
checar "voluntário NÃO envia na pasta restrita" "$(envia "$VOL" "ong/$PATA/restrito/$PET/v.pdf" "$TMP/exame.pdf" application/pdf)" "400"
checar "outra ONG NÃO envia na pasta da Pata Amada" "$(envia "$SOSU" "ong/$PATA/equipe/$PET/s.pdf" "$TMP/exame.pdf" application/pdf)" "400"
checar "coordenação envia termo (pasta restrita)" "$(envia "$COORD" "$RESTRITO" "$TMP/exame.pdf" application/pdf)" "200"
checar "tipo não permitido (texto) é recusado" "$(envia "$COORD" "ong/$PATA/equipe/$PET/n.txt" "$TMP/nota.txt" text/plain)" "400"
envia "$COORD" "ong/$PATA/equipe/$PET/g.pdf" "$TMP/grande.pdf" application/pdf >/dev/null
checar "arquivo acima de 5 MB é recusado (Storage responde 413 no corpo)" "$(jq -r .statusCode /tmp/up.json)" "413"

echo "== leitura por URL assinada"
URL=$(assina "$VOL" "$EQUIPE")
checar "voluntário gera link do exame" "$([[ -n $URL ]] && echo sim)" "sim"
checar "link baixa o arquivo certo" "$(curl -s "$API/storage/v1$URL" | head -c 8)" "%PDF-1.4"
checar "voluntário NÃO gera link do documento restrito" "$(assina "$VOL" "$RESTRITO")" ""
checar "outra ONG NÃO gera link do exame" "$(assina "$SOSU" "$EQUIPE")" ""
checar "coordenação gera link do restrito" "$([[ -n $(assina "$COORD" "$RESTRITO") ]] && echo sim)" "sim"
checar "sem login NÃO baixa direto" "$(curl -s -o /dev/null -w '%{http_code}' "$API/storage/v1/object/authenticated/documentos/$EQUIPE" -H "apikey: $ANON")" "400"

echo "== exclusão do pet leva os arquivos"
checar "arquivos no Storage antes" "$(( $(lista "ong/$PATA/equipe/$PET") + $(lista "ong/$PATA/restrito/$PET") ))" "2"
# lote do PostgREST exige as mesmas chaves em todos os objetos
svc -X POST "$API/rest/v1/documento" -d "[{\"animal_id\":$PET,\"tipo\":\"exame\",\"nome\":\"exame.pdf\",\"caminho\":\"$EQUIPE\",\"restrito\":false},{\"animal_id\":$PET,\"tipo\":\"termo_adocao\",\"nome\":\"termo.pdf\",\"caminho\":\"$RESTRITO\",\"restrito\":true}]" | head -c 300; echo
checar "registros de documento criados" "$(svc "$API/rest/v1/documento?animal_id=eq.$PET&select=id" | jq length)" "2"
st=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$API/functions/v1/cloudinary" -H "apikey: $ANON" -H "Authorization: Bearer $COORD" -H "Content-Type: application/json" -d "{\"acao\":\"apagar_animal\",\"animal_id\":$PET}")
checar "coordenação exclui o pet" "$st" "200"
checar "arquivos no Storage depois" "$(( $(lista "ong/$PATA/equipe/$PET") + $(lista "ong/$PATA/restrito/$PET") ))" "0"
checar "registros de documento apagados" "$(svc "$API/rest/v1/documento?animal_id=eq.$PET&select=id" | jq length)" "0"
