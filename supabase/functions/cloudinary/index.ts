// Operações no Cloudinary que exigem o api_secret:
//   { acao: "assinar_foto", animal_id }  → assinatura para upload direto do browser
//   { acao: "assinar_logo", ong_id }     → idem, para a logo da ONG (sobrescreve)
//   { acao: "apagar_foto", foto_id }     → remove do Cloudinary e da tabela foto
//   { acao: "apagar_animal", animal_id } → remove todas as fotos e o animal

import { admin, erro, json, podeCoordenarOng, podeGerirOng, servir } from "../_shared/http.ts";

const CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;
const API = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

// Limita fotos de celular a 2000px já na entrada, economizando armazenamento.
const TRANSFORMACAO_ENTRADA = "c_limit,w_2000,h_2000";

const sha1 = async (texto: string) => {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

// https://cloudinary.com/documentation/authentication_signatures
const assinar = async (params: Record<string, string | number>) => {
  const texto = Object.keys(params)
    .sort()
    .map((chave) => `${chave}=${params[chave]}`)
    .join("&");
  return { ...params, signature: await sha1(texto + API_SECRET), api_key: API_KEY };
};

const agora = () => Math.floor(Date.now() / 1000);

const destruir = async (publicId: string) => {
  const form = new FormData();
  const assinado = await assinar({ invalidate: "true", public_id: publicId, timestamp: agora() });
  Object.entries(assinado).forEach(([chave, valor]) => form.append(chave, String(valor)));
  const resposta = await fetch(`${API}/image/destroy`, { method: "POST", body: form });
  if (!resposta.ok) throw new Error(`Cloudinary destroy falhou: ${await resposta.text()}`);
};

const buscarAnimal = async (animalId: unknown) => {
  const { data } = await admin
    .from("animal")
    .select("id, ong_id")
    .eq("id", Number(animalId))
    .maybeSingle();
  return data;
};

servir(async (perfil, body) => {
  switch (body.acao) {
    case "assinar_foto": {
      const animal = await buscarAnimal(body.animal_id);
      if (!animal || !podeGerirOng(perfil, animal.ong_id)) {
        return erro("Sem permissão para este animal", 403);
      }
      const pasta = `pets/${animal.id}`;
      const assinado = await assinar({
        asset_folder: pasta,
        public_id: `${pasta}/${crypto.randomUUID()}`,
        timestamp: agora(),
        transformation: TRANSFORMACAO_ENTRADA,
      });
      return json({ ...assinado, cloud_name: CLOUD_NAME });
    }

    case "assinar_logo": {
      const ongId = Number(body.ong_id);
      if (!podeCoordenarOng(perfil, ongId)) return erro("Só a coordenação da ONG troca a logo", 403);
      const pasta = `ongs/${ongId}`;
      const assinado = await assinar({
        asset_folder: pasta,
        invalidate: "true",
        overwrite: "true",
        public_id: `${pasta}/logo`,
        timestamp: agora(),
        transformation: TRANSFORMACAO_ENTRADA,
      });
      return json({ ...assinado, cloud_name: CLOUD_NAME });
    }

    case "apagar_foto": {
      const { data: foto } = await admin
        .from("foto")
        .select("id, public_id, animal:animal_id (ong_id)")
        .eq("id", Number(body.foto_id))
        .maybeSingle();
      // deno-lint-ignore no-explicit-any
      const ongId = (foto?.animal as any)?.ong_id;
      if (!foto || !podeGerirOng(perfil, ongId)) return erro("Sem permissão para esta foto", 403);

      await destruir(foto.public_id);
      await admin.from("foto").delete().eq("id", foto.id);
      return json({ ok: true });
    }

    case "apagar_animal": {
      // a service role ignora a RLS: a regra "só coordenação apaga" vale aqui também
      const animal = await buscarAnimal(body.animal_id);
      if (!animal || !podeCoordenarOng(perfil, animal.ong_id)) {
        return erro("Só a coordenação da ONG pode excluir pets", 403);
      }

      const { data: fotos } = await admin.from("foto").select("public_id").eq("animal_id", animal.id);
      for (const foto of fotos ?? []) await destruir(foto.public_id);

      const { error } = await admin.from("animal").delete().eq("id", animal.id);
      if (error) throw error;
      return json({ ok: true });
    }

    default:
      return erro("Ação desconhecida");
  }
});
