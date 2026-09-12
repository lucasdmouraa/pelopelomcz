#!/usr/bin/env python3
"""Popula a ONG TESTE com dados FICTÍCIOS usando as mesmas APIs e regras do
painel (RLS, triggers, Edge Functions, Storage). Uso:

    python3 supabase/demo/popular_ong_teste.py           # cria o cenário
    python3 supabase/demo/popular_ong_teste.py --limpar  # apaga só o que este script cria

Equipe fictícia: carla.coordenacao@example.com (coordenação) e
ana.voluntaria@example.com (voluntária). example.com é reservado: não entrega
e-mail. As senhas são aleatórias e descartadas; para entrar como elas, gere um
"Novo link de acesso" em ONGs e acessos.
"""
import base64
import os
import io
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REF = open(f"{RAIZ}/supabase/.temp/project-ref").read().strip()
API = f"https://{REF}.supabase.co"
ENV = dict(l.strip().split("=", 1) for l in open(f"{RAIZ}/.env.local") if "=" in l)
ANON = ENV["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
CLOUD = ENV["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"]
_chaves = subprocess.run(
    ["supabase", "projects", "api-keys", "--project-ref", REF, "-o", "json"],
    capture_output=True, text=True, cwd=RAIZ,
).stdout
SERVICE = next(k["api_key"] for k in json.loads(_chaves) if k["name"] == "service_role")

TZ = ZoneInfo("America/Maceio")
AGORA = datetime.now(timezone.utc)
HOJE = AGORA.astimezone(TZ).date()
SLUG_ONG = "ong-teste"
EQUIPE = {
    "carla": ("carla.coordenacao@example.com", "Carla Souza", "coordenacao"),
    "ana": ("ana.voluntaria@example.com", "Ana Lima", "voluntario"),
}


# --- HTTP -------------------------------------------------------------------

def req(metodo, url, token=None, corpo=None, headers=None, bruto=None, chave=ANON):
    h = {"apikey": chave}
    if token:
        h["Authorization"] = f"Bearer {token}"
    dados = bruto
    if corpo is not None:
        dados = json.dumps(corpo).encode()
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    pedido = urllib.request.Request(url, data=dados, method=metodo, headers=h)
    try:
        with urllib.request.urlopen(pedido) as resp:
            texto = resp.read().decode()
            status = resp.status
    except urllib.error.HTTPError as e:
        texto, status = e.read().decode(), e.code
    try:
        return status, json.loads(texto) if texto.strip() else None
    except json.JSONDecodeError:
        return status, texto


def ok(resultado, oque):
    status, corpo = resultado
    if status >= 300:
        sys.exit(f"FALHOU {oque}: HTTP {status} {corpo}")
    return corpo


def svc(metodo, caminho, corpo=None, headers=None):
    return req(metodo, API + caminho, SERVICE, corpo, headers, chave=SERVICE)


def rest(token, metodo, caminho, corpo=None, retorno=False):
    headers = {"Prefer": "return=representation"} if retorno else {}
    return req(metodo, f"{API}/rest/v1/{caminho}", token, corpo, headers)


def inserir(token, tabela, dados, oque=None):
    linhas = ok(rest(token, "POST", tabela, dados, retorno=True), oque or f"inserir em {tabela}")
    return linhas[0] if isinstance(linhas, list) and linhas else linhas


def login(email, senha):
    return ok(req("POST", f"{API}/auth/v1/token?grant_type=password",
                  corpo={"email": email, "password": senha}), f"login {email}")["access_token"]


def dia(n):
    return (HOJE + timedelta(days=n)).isoformat()


def momento(dias, hora, minuto=0):
    return datetime.combine(HOJE + timedelta(days=dias), time(hora, minuto), TZ).isoformat()


# --- equipe fictícia ----------------------------------------------------------

def usuarios_ficticios():
    lista = svc("GET", "/auth/v1/admin/users?per_page=1000")[1]["users"]
    emails = {e for e, _, _ in EQUIPE.values()}
    return [u for u in lista if u["email"] in emails]


def criar_equipe(ong_id):
    tokens = {}
    for chave, (email, nome, funcao) in EQUIPE.items():
        senha = secrets.token_urlsafe(18)
        usuario = ok(svc("POST", "/auth/v1/admin/users", {
            "email": email, "password": senha, "email_confirm": True,
            "user_metadata": {"display_name": nome},
        }), f"criar {email}")
        ok(svc("POST", "/rest/v1/perfil", {
            "user_id": usuario["id"], "papel": "ong", "ong_id": ong_id,
            "funcao": funcao, "nome": nome, "email": email,
        }), f"perfil {email}")
        tokens[chave] = login(email, senha)
    return tokens


# --- arquivos fictícios ---------------------------------------------------------

def fonte(tamanho):
    for caminho in ("/System/Library/Fonts/Supplemental/Arial.ttf",
                    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"):
        try:
            return ImageFont.truetype(caminho, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()


def documento_ficticio(titulo, linhas, formato):
    img = Image.new("RGB", (1240, 1754), "white")
    d = ImageDraw.Draw(img)
    d.rectangle((40, 40, 1200, 1714), outline=(180, 180, 180), width=3)
    d.text((80, 80), "DOCUMENTO FICTÍCIO — TESTE DO PELOPELO", fill=(200, 30, 30), font=fonte(44))
    d.text((80, 170), titulo, fill=(40, 40, 40), font=fonte(56))
    y = 290
    for linha in linhas:
        d.text((80, y), linha, fill=(60, 60, 60), font=fonte(34))
        y += 60
    d.text((80, 1620), "Sem valor legal. Gerado para demonstrar o painel.", fill=(150, 150, 150), font=fonte(28))
    buf = io.BytesIO()
    if formato == "pdf":
        img.save(buf, "PDF", resolution=150)
        return buf.getvalue(), "application/pdf", "pdf"
    img.save(buf, "JPEG", quality=75)
    return buf.getvalue(), "image/jpeg", "jpg"


def logo_ficticia():
    img = Image.new("RGB", (600, 600), (66, 179, 173))
    d = ImageDraw.Draw(img)
    d.ellipse((60, 60, 540, 540), fill="white")
    d.text((300, 270), "ONG", fill=(93, 40, 10), font=fonte(110), anchor="mm")
    d.text((300, 380), "TESTE", fill=(93, 40, 10), font=fonte(90), anchor="mm")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# --- passos do painel -------------------------------------------------------------

def cloudinary_upload(token, acao, alvo, origem):
    assinatura = ok(req("POST", f"{API}/functions/v1/cloudinary", token, {"acao": acao, **alvo}),
                    f"assinar {acao}")
    campos = {k: str(v) for k, v in assinatura.items() if k != "cloud_name"}
    campos["file"] = origem
    pedido = urllib.request.Request(
        f"https://api.cloudinary.com/v1_1/{assinatura['cloud_name']}/image/upload",
        data=urllib.parse.urlencode(campos).encode(), method="POST")
    with urllib.request.urlopen(pedido) as resp:
        return json.loads(resp.read())


def foto(token, animal_id, origem, ordem=0):
    enviado = cloudinary_upload(token, "assinar_foto", {"animal_id": animal_id}, origem)
    ok(rest(token, "POST", "foto", {"animal_id": animal_id, "public_id": enviado["public_id"], "ordem": ordem}),
       "gravar foto")


def documento(token, ong_id, animal_id, tipo, nome, titulo, linhas, formato="pdf", restrito=False):
    conteudo, mime, ext = documento_ficticio(titulo, linhas, formato)
    caminho = f"ong/{ong_id}/{'restrito' if restrito else 'equipe'}/{animal_id}/{uuid.uuid4()}.{ext}"
    ok(req("POST", f"{API}/storage/v1/object/documentos/{caminho}", token, bruto=conteudo,
           headers={"Content-Type": mime}), f"enviar {nome}")
    ok(rest(token, "POST", "documento", {
        "animal_id": animal_id, "tipo": tipo, "nome": nome, "caminho": caminho,
        "mime": mime, "tamanho": len(conteudo), "restrito": restrito,
    }), f"registrar {nome}")


def evento(token, animal_id, tipo, dias, produto=None, descricao=None, proxima=None, peso=None, valor=None):
    ok(rest(token, "POST", "evento_saude", {
        "animal_id": animal_id, "tipo": tipo, "data": dia(dias), "produto": produto,
        "descricao": descricao, "proxima_data": dia(proxima) if proxima is not None else None,
        "peso_kg": peso, "valor": valor,
    }), f"evento {tipo} {produto or ''}")


def doses_passadas(token, animal_id, dias_atras):
    return ok(req("POST", f"{API}/rest/v1/rpc/doses_previstas", token, {
        "de": (AGORA - timedelta(days=dias_atras)).isoformat(),
        "ate": AGORA.isoformat(), "p_animal": animal_id,
    }), "doses previstas")


def dar_dose(token, slot, pulada=False, observacao=None, atraso_min=10):
    previsto = datetime.fromisoformat(slot["previsto_para"])
    dada_em = min(previsto + timedelta(minutes=atraso_min), AGORA)
    ok(rest(token, "POST", "dose", {
        "tratamento_id": slot["tratamento_id"], "previsto_para": slot["previsto_para"],
        "dada_em": dada_em.isoformat(), "pulada": pulada, "observacao": observacao,
    }), "registrar dose")


# --- cenário ------------------------------------------------------------------------

def popular():
    ong = svc("GET", f"/rest/v1/ong?slug=eq.{SLUG_ONG}&select=id")[1]
    if not ong:
        sys.exit("ONG TESTE não encontrada")
    ong_id = ong[0]["id"]
    if svc("GET", f"/rest/v1/animal?ong_id=eq.{ong_id}&select=id")[1] or usuarios_ficticios():
        sys.exit("A ONG TESTE já tem dados ou a equipe fictícia já existe: rode com --limpar antes.")

    t = criar_equipe(ong_id)
    carla, ana = t["carla"], t["ana"]
    print("equipe fictícia criada: Carla Souza (coordenação), Ana Lima (voluntária)")

    # perfil e logo da ONG (coordenação)
    logo = cloudinary_upload(carla, "assinar_logo", {"ong_id": ong_id}, logo_ficticia())
    ok(rest(carla, "PATCH", f"ong?id=eq.{ong_id}", {
        "logo_url": logo["secure_url"],
        "descricao": "ONG fictícia para testar o painel do PeloPelo. Pets, pedidos e documentos daqui são de exemplo.",
    }), "perfil da ONG")
    print("perfil e logo da ONG TESTE")

    def pet(token, nome, especie, sexo, porte, idade, status, descricao, **saude):
        dados = {"ong_id": ong_id, "nome": nome, "especie": especie, "sexo": sexo, "porte": porte,
                 "idade": idade, "status": status, "descricao": descricao,
                 "vacinado": saude.get("vacinado", False), "vermifugado": saude.get("vermifugado", False),
                 "castrado": saude.get("castrado", False), "especial": saude.get("especial", False)}
        return inserir(token, "animal", dados, f"cadastrar {nome}")

    CAES = f"https://res.cloudinary.com/{CLOUD}/image/upload/c_crop,w_900,h_1800,x_{{x}},y_0/samples/animals/three-dogs"

    # todos nascem disponíveis para receberem pedidos pelo site; depois a
    # coordenação muda a situação de quem não está mais disponível
    bolinha = pet(carla, "Bolinha", "cachorro", "macho", "pequeno", "2 anos", "disponivel",
                  "Brincalhão e muito carinhoso. Resgatado na orla da Pajuçara, se dá bem com crianças e outros cães.",
                  vacinado=True, vermifugado=True, castrado=True)
    luna = pet(carla, "Luna", "gato", "femea", "pequeno", "1 ano", "disponivel",
               "Gata tranquila, adora janela e colo. Usa caixa de areia direitinho.",
               vermifugado=True, castrado=True)
    sansao = pet(carla, "Sansão", "cachorro", "macho", "gigante", "6 anos", "disponivel",
                 "Grandão de coração mole. Precisa de quintal e passeios diários.", castrado=True)
    thor = pet(carla, "Thor", "cachorro", "macho", "grande", "4 anos", "disponivel",
               "Companheiro e protetor, ótimo para casa com espaço.", vacinado=True, vermifugado=True, castrado=True)
    caramelo = pet(carla, "Caramelo", "cachorro", "macho", "medio", "3 anos", "disponivel",
                   "O clássico vira-lata caramelo: leal e alegre.", vacinado=True, vermifugado=True, castrado=True)
    dona_flor = pet(carla, "Dona Flor", "cachorro", "femea", "medio", "12 anos", "morador",
                    "Idosa e cardiopata: mora no abrigo e recebe remédio duas vezes ao dia.",
                    vacinado=True, castrado=True, especial=True)
    bigode = pet(carla, "Bigode", "gato", "macho", "medio", "8 anos", "morador",
                 "FIV positivo, vive bem no gatil do abrigo. Muito sociável.",
                 vermifugado=True, castrado=True, especial=True)
    nina = pet(carla, "Nina", "gato", "femea", "pequeno", "15 anos", "morador",
               "Viveu os últimos anos no abrigo, cercada de carinho.", castrado=True)
    # cadastrada pela voluntária: o banco força "recém-chegado", mesmo pedindo disponível
    pipoca = pet(ana, "Pipoca", "gato", "femea", "pequeno", "3 meses", "disponivel",
                 "Filhote encontrada em uma caixa de papelão no Jacintinho.")
    print(f"pets: 9 cadastrados (Pipoca, pela voluntária, ficou '{pipoca['status']}')")

    # fotos (3 cães recortados da mesma foto de exemplo, gato e filhote)
    foto(carla, bolinha["id"], CAES.format(x=0))
    foto(carla, thor["id"], CAES.format(x=900))
    foto(carla, sansao["id"], CAES.format(x=1800))
    foto(ana, luna["id"], f"https://res.cloudinary.com/{CLOUD}/image/upload/samples/animals/cat")
    foto(ana, pipoca["id"], f"https://res.cloudinary.com/{CLOUD}/image/upload/samples/animals/kitten-playing")
    print("fotos: Bolinha, Thor, Sansão, Luna e Pipoca (Dona Flor, Bigode, Caramelo e Nina ficam sem foto)")

    # fichas internas
    fichas = [
        (carla, dona_flor, {"data_entrada": "2019-05-10", "origem_resgate": "Abandonada idosa na Praça Sinimbu",
                            "condicao_chegada": "Magra, com sopro cardíaco e dermatite.", "microchip": "982000000000001",
                            "observacoes": "Não tolera calor: manter na sala ventilada."}),
        (carla, bigode, {"data_entrada": "2021-02-03", "origem_resgate": "Colônia de gatos no Farol",
                         "condicao_chegada": "Desnutrido, teste FIV positivo.",
                         "observacoes": "Separar a ração: come a dos outros."}),
        (ana, pipoca, {"data_entrada": dia(-5), "origem_resgate": "Caixa de papelão no Jacintinho",
                       "condicao_chegada": "Desidratada, espirrando."}),
        (carla, bolinha, {"data_entrada": dia(-120), "origem_resgate": "Orla da Pajuçara"}),
        (carla, nina, {"data_entrada": "2018-08-20", "origem_resgate": "Entregue por tutora que se mudou",
                       "data_obito": dia(-20), "causa_obito": "Insuficiência renal crônica"}),
    ]
    # a ficha nasce junto com o pet (trigger): aqui só completa (upsert)
    for token, animal, dados in fichas:
        ok(req("POST", f"{API}/rest/v1/animal_ficha", token, {"animal_id": animal["id"], **dados},
               {"Prefer": "resolution=merge-duplicates"}), f"ficha {animal['nome']}")
    print("fichas: Dona Flor, Bigode, Pipoca, Bolinha e Nina")

    # prontuário (mais antigo primeiro: o reforço resolve o aviso anterior)
    evento(carla, bolinha["id"], "castracao", -150, descricao="Castração no mutirão do CCZ", valor=150)
    evento(ana, bolinha["id"], "vacina", -60, "V10", proxima=305, valor=90)
    evento(ana, bolinha["id"], "vacina", -60, "Antirrábica", proxima=305, valor=40)
    evento(ana, bolinha["id"], "vermifugo", -30, "Drontal", proxima=60)
    evento(ana, bolinha["id"], "peso", -30, peso=8.2)

    evento(ana, luna["id"], "vacina", -395, "V4 (felina)", proxima=-10, valor=85)          # ATRASADA
    evento(carla, luna["id"], "castracao", -100, descricao="Castração com a veterinária parceira", valor=180)
    evento(ana, luna["id"], "vermifugo", -87, "Milbemax", proxima=3)                          # vence em 3 dias
    evento(carla, luna["id"], "consulta", -20, descricao="Check-up: saudável, liberada para adoção.")

    evento(ana, sansao["id"], "vacina", -390, "Antirrábica", proxima=-25)                     # ATRASADA
    evento(carla, sansao["id"], "exame", -10, "Hemograma", "Sem alterações.", valor=60)
    evento(ana, sansao["id"], "peso", -10, peso=58)

    evento(ana, thor["id"], "vacina", -45, "V10", proxima=320)
    evento(ana, thor["id"], "vacina", -45, "Antirrábica", proxima=320)
    evento(ana, thor["id"], "peso", -15, peso=32.5)

    evento(ana, dona_flor["id"], "vacina", -200, "V10", proxima=165)
    evento(ana, dona_flor["id"], "peso", -90, peso=14.1)
    evento(ana, dona_flor["id"], "peso", -60, peso=14.6)
    evento(carla, dona_flor["id"], "consulta", -30, descricao="Cardiologista: sopro grau III. Iniciar enalapril.",
           proxima=30, valor=200)
    evento(carla, dona_flor["id"], "exame", -29, "Ecocardiograma", "Laudo anexado em Documentos.", valor=250)
    evento(ana, dona_flor["id"], "peso", -5, peso=15.0)

    evento(ana, bigode["id"], "vacina", -362, "V4 (felina)", proxima=3)                      # vence em 3 dias
    evento(carla, bigode["id"], "consulta", -10, descricao="FIV+ estável. Conjuntivite: colírio a cada 2 dias.")
    evento(ana, bigode["id"], "peso", -10, peso=4.3)

    evento(ana, pipoca["id"], "vermifugo", -4, "Vermífugo pediátrico", proxima=11)
    evento(carla, pipoca["id"], "consulta", -3, descricao="Triagem: infecção respiratória leve. Antibiótico por 7 dias.")
    evento(ana, pipoca["id"], "peso", -4, peso=0.9)

    evento(ana, caramelo["id"], "vacina", -120, "V10", proxima=245)
    evento(carla, caramelo["id"], "castracao", -110, valor=150)

    evento(carla, nina["id"], "consulta", -40, descricao="Doença renal crônica avançada. Cuidados paliativos.")
    evento(carla, nina["id"], "exame", -40, "Creatinina", "Muito acima do normal.")
    print("prontuário: vacinas aplicadas, 2 atrasadas (Luna, Sansão), 2 vencendo em 3 dias (Luna, Bigode)")

    # remédios (coordenação cadastra) e doses (equipe marca)
    ok(rest(carla, "POST", "tratamento", {
        "animal_id": dona_flor["id"], "medicamento": "Enalapril", "dose": "1 comprimido", "via": "oral",
        "horarios": ["08:00", "20:00"], "inicio": momento(-30, 7), "instrucoes": "Dar junto com a comida."}),
        "tratamento Dona Flor")
    ok(rest(carla, "POST", "tratamento", {
        "animal_id": pipoca["id"], "medicamento": "Amoxicilina", "dose": "0,5 ml", "via": "oral",
        "horarios": ["08:00", "14:00", "20:00"], "inicio": momento(-3, 7, 30), "fim": momento(4, 7, 30),
        "instrucoes": "Agitar antes de usar. Guardar na geladeira."}), "tratamento Pipoca")
    ok(rest(carla, "POST", "tratamento", {
        "animal_id": bigode["id"], "medicamento": "Colírio de tobramicina", "dose": "1 gota em cada olho",
        "via": "colirio", "horarios": ["09:00", "21:00"], "intervalo_dias": 2, "inicio": momento(-10, 8)}),
        "tratamento Bigode")
    ok(rest(carla, "POST", "tratamento", {
        "animal_id": nina["id"], "medicamento": "Benazepril", "dose": "1/2 comprimido", "via": "oral",
        "horarios": ["08:00"], "inicio": momento(-60, 7)}), "tratamento Nina")
    ok(rest(carla, "POST", "tratamento", {
        "animal_id": bigode["id"], "medicamento": "Dipirona", "dose": "2 gotas", "via": "oral",
        "instrucoes": "Só se tiver febre ou dor.", "horarios": []}), "tratamento se necessário")

    marcadas = 0
    for i, slot in enumerate(doses_passadas(ana, dona_flor["id"], 2)):
        dar_dose(ana if i % 2 else carla, slot)
        marcadas += 1
    slots_pipoca = doses_passadas(ana, pipoca["id"], 3)
    pulada_ontem = momento(-1, 14)
    for slot in slots_pipoca[:-1]:  # a mais recente fica pendente: aparece como atrasada
        eh_pulada = datetime.fromisoformat(slot["previsto_para"]) == datetime.fromisoformat(pulada_ontem)
        dar_dose(ana, slot, pulada=eh_pulada,
                 observacao="Vomitou antes; a veterinária orientou pular esta dose." if eh_pulada else None)
        marcadas += 1
    for slot in doses_passadas(ana, bigode["id"], 3):
        dar_dose(carla, slot, atraso_min=25)
        marcadas += 1
    print(f"remédios: 5 tratamentos, {marcadas} doses registradas, 1 dose da Pipoca deixada atrasada")

    # pedidos de adoção pelo site (chave pública, igual ao formulário "Quero Adotar")
    pedidos = {}
    for animal, nome, fone, cpf in [
        (bolinha, "Mariana Alves", "(82) 9 9111-2233", "111.222.333-44"),
        (luna, "Rafael Costa", "(82) 9 9222-3344", "222.333.444-55"),
        (thor, "Juliana Mendes", "(82) 9 9333-4455", "333.444.555-66"),
        (caramelo, "Pedro Henrique Santos", "(82) 9 9444-5566", "444.555.666-77"),
        (sansao, "Lucas Ferreira", "(82) 9 9555-6677", "555.666.777-88"),
    ]:
        ok(rest(None, "POST", "adoption_request", {"name": nome, "contact": fone, "cpf": cpf, "pet_id": animal["id"]}),
           f"pedido para {animal['nome']}")
        pedidos[animal["nome"]] = rest(carla, "GET", f"adoption_request?pet_id=eq.{animal['id']}&select=id")[1][0]["id"]
    for nome_pet, status, observacao in [
        ("Luna", "em_contato", "Ligou em " + dia(-2)[8:10] + "/" + dia(-2)[5:7] + ", quer visitar no sábado."),
        ("Thor", "em_contato", "Entrevista feita. Visita à casa marcada."),
        ("Caramelo", "concluido", "Adoção concluída. Termo assinado (ver Documentos)."),
        ("Sansão", "recusado", "Mora em apartamento pequeno; combinamos procurar um porte menor."),
    ]:
        ok(rest(carla, "PATCH", f"adoption_request?id=eq.{pedidos[nome_pet]}",
                {"status": status, "observacao": observacao}), f"andamento do pedido de {nome_pet}")
    print("pedidos: 5 (novo, 2 em contato, concluído, não seguiu)")

    # situações finais (coordenação)
    for animal, status in [(thor, "em_processo"), (caramelo, "adotado"), (nina, "falecido")]:
        ok(rest(carla, "PATCH", f"animal?id=eq.{animal['id']}", {"status": status}), f"situação de {animal['nome']}")
    print("situações: Thor em processo, Caramelo adotado, Nina falecida (tratamento dela encerrado sozinho)")

    # documentos fictícios
    documento(carla, ong_id, dona_flor["id"], "exame", "ecocardiograma-dona-flor.pdf", "Laudo de ecocardiograma",
              ["Paciente: Dona Flor (cão, 12 anos)", "Sopro mitral grau III", "Conduta: enalapril 2x ao dia",
               "Retorno em 30 dias"])
    documento(ana, ong_id, bigode["id"], "carteira_vacinacao", "carteira-bigode.jpg", "Carteira de vacinação",
              ["Paciente: Bigode (gato, 8 anos)", "V4 felina — aplicada há 1 ano", "Próxima dose: em 3 dias"],
              formato="jpg")
    documento(ana, ong_id, pipoca["id"], "receita", "receita-pipoca.pdf", "Receita veterinária",
              ["Paciente: Pipoca (gata, 3 meses)", "Amoxicilina 0,5 ml às 8h, 14h e 20h", "Por 7 dias"])
    documento(carla, ong_id, caramelo["id"], "termo_adocao", "termo-adocao-caramelo.pdf", "Termo de adoção",
              ["Animal: Caramelo (cão, 3 anos)", "Adotante: Pedro Henrique Santos (fictício)",
               "CPF: 444.555.666-77 (fictício)", "Compromisso de castração e vacinação em dia"], restrito=True)
    documento(carla, ong_id, thor["id"], "nota_fiscal", "recibo-vacinas-thor.jpg", "Recibo de vacinas",
              ["Clínica Veterinária Fictícia", "V10 + Antirrábica — Thor", "Valor: R$ 130,00"],
              formato="jpg", restrito=True)
    print("documentos: 3 da equipe + 2 restritos à coordenação (termo de adoção e recibo)")

    print("\nPRONTO. O site é atualizado sozinho em alguns minutos (Bolinha, Luna e Sansão aparecem para adoção).")


def limpar():
    ong = svc("GET", f"/rest/v1/ong?slug=eq.{SLUG_ONG}&select=id")[1]
    ong_id = ong[0]["id"]
    ficticios = usuarios_ficticios()
    carla = next((u for u in ficticios if u["email"] == EQUIPE["carla"][0]), None)
    animais = svc("GET", f"/rest/v1/animal?ong_id=eq.{ong_id}&select=id,nome")[1]
    if animais:
        if not carla:
            sys.exit("Sem a coordenação fictícia para excluir os pets pela Edge Function.")
        senha = secrets.token_urlsafe(18)
        ok(svc("PUT", f"/auth/v1/admin/users/{carla['id']}", {"password": senha}), "senha temporária")
        token = login(carla["email"], senha)
        for animal in animais:  # remove fotos (Cloudinary), arquivos (Storage) e linhas
            ok(req("POST", f"{API}/functions/v1/cloudinary", token, {"acao": "apagar_animal", "animal_id": animal["id"]}),
               f"excluir {animal['nome']}")
    for usuario in ficticios:
        ok(svc("DELETE", f"/auth/v1/admin/users/{usuario['id']}"), f"remover {usuario['email']}")
    print(f"removidos: {len(animais or [])} pets (com fotos, documentos e pedidos) e {len(ficticios)} pessoas fictícias")


if __name__ == "__main__":
    limpar() if "--limpar" in sys.argv else popular()
