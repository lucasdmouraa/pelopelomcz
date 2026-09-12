// Gestão de acessos ao painel (somente admin). Não depende de e-mail: devolve
// o link de acesso para o admin enviar por WhatsApp ou como preferir.
//
// O link aponta para /painel/definir-senha com o token_hash, e não para o
// /auth/v1/verify do Supabase: prévias de link (WhatsApp, antivírus de e-mail)
// abririam a URL e consumiriam o token de uso único antes da pessoa clicar.
// Na nossa página o token só é validado quando a pessoa envia a senha.
//   { acao: "convidar", email, nome?, papel: "ong" | "admin", ong_id?, redirect_to }
//       → cria o usuário (ou gera novo link se já existir) e grava o perfil
//   { acao: "remover", user_id } → apaga o usuário e o perfil

import { admin, erro, json, servir } from "../_shared/http.ts";

servir(async (perfil, body) => {
  if (perfil.papel !== "admin") return erro("Apenas administradores", 403);

  switch (body.acao) {
    case "convidar": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const nome = body.nome ? String(body.nome).trim() : null;
      const papel = body.papel === "admin" ? "admin" : "ong";
      const ongId = papel === "ong" ? Number(body.ong_id) : null;
      const redirectTo = String(body.redirect_to ?? "");

      if (!/^\S+@\S+\.\S+$/.test(email)) return erro("E-mail inválido");
      if (!/^https?:\/\//.test(redirectTo)) return erro("redirect_to inválido");
      if (papel === "ong") {
        const { data: ong } = await admin.from("ong").select("id").eq("id", ongId).maybeSingle();
        if (!ong) return erro("ONG não encontrada");
      }

      // Usuário novo recebe link de convite; quem já existe recebe link para
      // redefinir a senha (serve também como "esqueci minha senha").
      let novo = true;
      let { data, error } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo, data: { nome } },
      });
      if (error?.code === "email_exists" || /already been registered/i.test(error?.message ?? "")) {
        novo = false;
        ({ data, error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        }));
      }
      if (error || !data.user) throw error ?? new Error("generateLink sem usuário");

      const { error: erroPerfil } = await admin.from("perfil").upsert({
        user_id: data.user.id,
        papel,
        ong_id: ongId,
        nome,
        email,
      });
      if (erroPerfil) throw erroPerfil;

      const link = new URL(redirectTo);
      link.searchParams.set("token_hash", data.properties.hashed_token);
      link.searchParams.set("type", data.properties.verification_type);
      return json({ link: link.toString(), novo });
    }

    case "remover": {
      const userId = String(body.user_id ?? "");
      if (userId === perfil.user_id) return erro("Você não pode remover o próprio acesso");
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    default:
      return erro("Ação desconhecida");
  }
});
