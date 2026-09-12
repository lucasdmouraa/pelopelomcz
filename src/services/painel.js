import { db } from "./supabase";

// Operações do painel (roda só no browser, com a sessão do usuário logado).
// A RLS garante que cada ONG só enxerga e altera o que é dela.

const traduzirErro = (error) => {
  const message = error?.message ?? "";
  if (/row-level security|permission denied/i.test(message))
    return new Error("Você não tem permissão para esta ação.");
  if (/ong_slug_key/i.test(message))
    return new Error("Já existe uma ONG com esse identificador.");
  if (/ong_slug_check/i.test(message))
    return new Error(
      "Identificador inválido: use letras minúsculas, números e hífens.",
    );
  return new Error(message || "Algo deu errado. Tente novamente.");
};

const executar = async (query) => {
  const { data, error } = await query;
  if (error) throw traduzirErro(error);
  return data;
};

const invocar = async (funcao, body) => {
  const { data, error } = await db.functions.invoke(funcao, { body });
  if (error) {
    const detalhe = await error.context?.json?.().catch(() => null);
    throw new Error(
      detalhe?.error ??
        "Não foi possível completar a operação. Tente novamente.",
    );
  }
  return data;
};

// Autenticação --------------------------------------------------------------

export const entrar = async (email, senha) => {
  const { error } = await db.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (error)
    throw new Error(
      /invalid/i.test(error.message)
        ? "E-mail ou senha incorretos."
        : error.message,
    );
};

export const validarLink = async (tokenHash, tipo) => {
  const { error } = await db.auth.verifyOtp({
    token_hash: tokenHash,
    type: tipo,
  });
  if (error)
    throw new Error(
      "Este link expirou ou já foi usado. Peça um novo ao administrador do PeloPelo.",
    );
};

export const definirSenha = async (senha) => {
  const { error } = await db.auth.updateUser({ password: senha });
  if (!error) return;
  if (/at least/i.test(error.message))
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  if (/different from the old/i.test(error.message))
    throw new Error("A nova senha precisa ser diferente da anterior.");
  throw new Error(error.message);
};

export const carregarPerfil = (userId) =>
  executar(
    db.from("perfil").select("*, ong (*)").eq("user_id", userId).maybeSingle(),
  );

// Pets ----------------------------------------------------------------------

const PET_FIELDS = "*, ong (id, nome), foto (id, public_id, ordem)";

const CAMPOS_PET = [
  "ong_id",
  "nome",
  "especie",
  "sexo",
  "porte",
  "idade",
  "descricao",
  "vacinado",
  "vermifugado",
  "castrado",
  "especial",
  "status",
];

export const listarPets = (ongId) => {
  let query = db
    .from("animal")
    .select(PET_FIELDS)
    .order("created_at", { ascending: false });
  // pets disponíveis de outras ONGs também são visíveis (vitrine pública)
  if (ongId) query = query.eq("ong_id", ongId);
  return executar(query);
};

export const buscarPet = (id) =>
  executar(db.from("animal").select(PET_FIELDS).eq("id", id).single());

export const salvarPet = ({ id, ...pet }) => {
  const dados = Object.fromEntries(
    CAMPOS_PET.map((campo) => [campo, pet[campo]]),
  );
  dados.nome = dados.nome.trim();
  dados.descricao = dados.descricao?.trim() || null;
  dados.ong_id = Number(dados.ong_id);

  const query = id
    ? db.from("animal").update(dados).eq("id", id)
    : db.from("animal").insert(dados);
  return executar(query.select().single());
};

export const apagarPet = (animalId) =>
  invocar("cloudinary", { acao: "apagar_animal", animal_id: animalId });

// Ficha interna (1:1). A ONG e a autoria são preenchidas pelo banco.
const CAMPOS_FICHA = [
  "data_entrada",
  "nascimento_aproximado",
  "microchip",
  "origem_resgate",
  "condicao_chegada",
  "observacoes",
  "data_obito",
  "causa_obito",
];

export const buscarFicha = (animalId) =>
  executar(
    db.from("animal_ficha").select("*").eq("animal_id", animalId).maybeSingle(),
  );

export const salvarFicha = (animalId, ficha) => {
  const dados = Object.fromEntries(
    CAMPOS_FICHA.map((campo) => [campo, ficha[campo]?.trim() || null]),
  );
  return executar(
    db
      .from("animal_ficha")
      .upsert({ animal_id: animalId, ...dados })
      .select()
      .single(),
  );
};

// Fotos (upload direto do browser para o Cloudinary, assinado pela Edge Function)

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // limite do plano gratuito do Cloudinary

const enviarParaCloudinary = async (arquivo, assinatura) => {
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error("A foto passa de 10 MB.");

  const { cloud_name, ...campos } = assinatura;
  const form = new FormData();
  form.append("file", arquivo);
  Object.entries(campos).forEach(([chave, valor]) => form.append(chave, valor));

  const resposta = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
    { method: "POST", body: form },
  );
  const resultado = await resposta.json();
  if (!resposta.ok)
    throw new Error(resultado.error?.message ?? "Falha ao enviar a foto.");
  return resultado;
};

export const listarFotos = (animalId) =>
  executar(
    db
      .from("foto")
      .select("id, public_id, ordem")
      .eq("animal_id", animalId)
      .order("ordem")
      .order("id"),
  );

export const enviarFoto = async (animalId, arquivo, ordem) => {
  const assinatura = await invocar("cloudinary", {
    acao: "assinar_foto",
    animal_id: animalId,
  });
  const { public_id } = await enviarParaCloudinary(arquivo, assinatura);
  return executar(
    db.from("foto").insert({ animal_id: animalId, public_id, ordem }),
  );
};

export const apagarFoto = (fotoId) =>
  invocar("cloudinary", { acao: "apagar_foto", foto_id: fotoId });

export const reordenarFotos = (fotos) =>
  Promise.all(
    fotos.map((foto, ordem) =>
      executar(db.from("foto").update({ ordem }).eq("id", foto.id)),
    ),
  );

// Pedidos de adoção -----------------------------------------------------------

export const listarPedidos = () =>
  executar(
    db
      .from("adoption_request")
      .select("*, animal:pet_id (id, nome, status, ong (nome))")
      .order("created_at", { ascending: false }),
  );

export const atualizarPedido = (id, dados) =>
  executar(db.from("adoption_request").update(dados).eq("id", id));

export const contarPedidosNovos = async () => {
  const { count } = await db
    .from("adoption_request")
    .select("id", { count: "exact", head: true })
    .eq("status", "novo");
  return count ?? 0;
};

// ONGs e acessos ----------------------------------------------------------------

const CAMPOS_ONG = [
  "nome",
  "descricao",
  "instagram",
  "site",
  "whatsapp",
  "email",
];

export const listarOngs = () =>
  executar(db.from("ong").select("*").order("nome"));

export const buscarOng = (id) =>
  executar(db.from("ong").select("*").eq("id", id).single());

export const salvarOng = ({ id, ...ong }, comoAdmin) => {
  const dados = Object.fromEntries(
    CAMPOS_ONG.map((campo) => [campo, ong[campo]?.trim() || null]),
  );
  // slug e situação só o admin define (a RLS/trigger também barram)
  if (comoAdmin) {
    dados.ativa = ong.ativa;
    if (!id) dados.slug = ong.slug;
  }

  const query = id
    ? db.from("ong").update(dados).eq("id", id)
    : db.from("ong").insert(dados);
  return executar(query.select().single());
};

export const enviarLogo = async (ongId, arquivo) => {
  const assinatura = await invocar("cloudinary", {
    acao: "assinar_logo",
    ong_id: ongId,
  });
  const { secure_url } = await enviarParaCloudinary(arquivo, assinatura);
  return executar(
    db.from("ong").update({ logo_url: secure_url }).eq("id", ongId),
  );
};

export const listarPerfis = () =>
  executar(db.from("perfil").select("*").order("created_at"));

export const listarEquipe = (ongId) =>
  executar(
    db.from("perfil").select("*").eq("ong_id", ongId).order("created_at"),
  );

// Sem `funcao`, quem já tem acesso mantém a função atual.
export const convidar = ({ email, nome, papel, ongId, funcao }) =>
  invocar("convidar", {
    acao: "convidar",
    email,
    nome,
    papel,
    ong_id: ongId,
    funcao,
    redirect_to: `${window.location.origin}/painel/definir-senha`,
  });

export const definirFuncao = (userId, funcao) =>
  invocar("convidar", { acao: "definir_funcao", user_id: userId, funcao });

export const removerAcesso = (userId) =>
  invocar("convidar", { acao: "remover", user_id: userId });

// Publicação do site ------------------------------------------------------------

export const estadoSite = () =>
  executar(db.from("site_estado").select("*").single());

export const publicarAgora = () => executar(db.rpc("publicar_agora"));
