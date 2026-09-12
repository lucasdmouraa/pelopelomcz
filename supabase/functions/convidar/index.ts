// Gestão de acessos ao painel. Não depende de e-mail: devolve o link de acesso
// para quem convidou enviar por WhatsApp ou como preferir.
//   { acao: "convidar", email, nome?, papel?, ong_id?, funcao?, redirect_to }
//       → cria o usuário (ou gera novo link se já existir) e grava o perfil
//   { acao: "definir_funcao", user_id, funcao } → coordenação ↔ voluntário
//   { acao: "remover", user_id } → apaga o usuário e o perfil
//
// Admin pode tudo. A coordenação de uma ONG só age sobre VOLUNTÁRIOS da própria
// ONG: um link de recuperação dá acesso à conta, então gerar link para o
// e-mail de um admin, de outra ONG ou de outra coordenação seria tomada de conta.
//
// O link aponta para /painel/definir-senha com o token_hash, e não para o
// /auth/v1/verify do Supabase: prévias de link (WhatsApp, antivírus de e-mail)
// abririam a URL e consumiriam o token de uso único antes da pessoa clicar.
// Na nossa página o token só é validado quando a pessoa envia a senha.

import { admin, erro, json, servir } from "../_shared/http.ts";

const FUNCOES = ["coordenacao", "voluntario"];

const buscarPerfil = async (userId: string) => {
  const { data } = await admin
    .from("perfil")
    .select("user_id, papel, ong_id, funcao")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
};

servir(async (perfil, body) => {
  const ehAdmin = perfil.papel === "admin";
  const ehCoordenacao = perfil.papel === "ong" && perfil.funcao === "coordenacao";
  if (!ehAdmin && !ehCoordenacao) {
    return erro("Apenas administradores e a coordenação da ONG", 403);
  }

  // alvo que a coordenação pode gerir: voluntário da própria ONG
  const voluntarioDaMinhaOng = (alvo: Awaited<ReturnType<typeof buscarPerfil>>) =>
    !!alvo && alvo.papel === "ong" && alvo.ong_id === perfil.ong_id && alvo.funcao === "voluntario";

  switch (body.acao) {
    case "convidar": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const nome = body.nome ? String(body.nome).trim() : null;
      const redirectTo = String(body.redirect_to ?? "");
      const funcaoPedida = FUNCOES.includes(String(body.funcao)) ? String(body.funcao) : null;

      // coordenação só convida para a própria ONG e nunca cria admin
      const papel = ehAdmin && body.papel === "admin" ? "admin" : "ong";
      const ongId = papel === "ong" ? (ehAdmin ? Number(body.ong_id) : perfil.ong_id) : null;

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

      const existente = novo ? null : await buscarPerfil(data.user.id);
      if (!novo && !ehAdmin && !voluntarioDaMinhaOng(existente)) {
        // o link gerado acima nunca é devolvido: expira sem uso
        return erro("Este e-mail já tem outro acesso. Peça ao administrador do PeloPelo.", 403);
      }

      // função: a pedida; senão mantém a atual; senão o padrão de quem convida
      const funcao =
        papel === "admin"
          ? null
          : (funcaoPedida ?? existente?.funcao ?? (ehAdmin ? "coordenacao" : "voluntario"));
      if (!ehAdmin && funcao === "coordenacao" && existente?.funcao !== "coordenacao" && !funcaoPedida) {
        return erro("Função inválida");
      }

      const { error: erroPerfil } = await admin.from("perfil").upsert({
        user_id: data.user.id,
        papel,
        ong_id: ongId,
        funcao,
        nome,
        email,
      });
      if (erroPerfil) throw erroPerfil;

      const link = new URL(redirectTo);
      link.searchParams.set("token_hash", data.properties.hashed_token);
      link.searchParams.set("type", data.properties.verification_type);
      return json({ link: link.toString(), novo });
    }

    case "definir_funcao": {
      const userId = String(body.user_id ?? "");
      const funcao = String(body.funcao ?? "");
      if (!FUNCOES.includes(funcao)) return erro("Função inválida");

      const alvo = await buscarPerfil(userId);
      if (!alvo || alvo.papel !== "ong") return erro("Pessoa não encontrada", 404);
      if (!ehAdmin && !(voluntarioDaMinhaOng(alvo) && funcao === "coordenacao")) {
        return erro("A coordenação só pode promover voluntários da própria ONG", 403);
      }
      if (alvo.funcao === "coordenacao" && funcao === "voluntario") {
        const { count } = await admin
          .from("perfil")
          .select("user_id", { count: "exact", head: true })
          .eq("ong_id", alvo.ong_id)
          .eq("funcao", "coordenacao");
        if ((count ?? 0) <= 1) return erro("A ONG precisa de pelo menos uma pessoa na coordenação");
      }

      const { error } = await admin.from("perfil").update({ funcao }).eq("user_id", userId);
      if (error) throw error;
      return json({ ok: true });
    }

    case "remover": {
      const userId = String(body.user_id ?? "");
      if (userId === perfil.user_id) return erro("Você não pode remover o próprio acesso");
      if (!ehAdmin && !voluntarioDaMinhaOng(await buscarPerfil(userId))) {
        return erro("A coordenação só remove voluntários da própria ONG", 403);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    default:
      return erro("Ação desconhecida");
  }
});
