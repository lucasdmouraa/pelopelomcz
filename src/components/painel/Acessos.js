"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import c from "clsx";
import { convidar, definirFuncao, removerAcesso } from "@/services/painel";
import { FuncaoMap } from "@/utils";
import { usePainel } from "./PainelShell";
import { Alert, ConfirmButton, Field } from "./ui";
import styles from "./Painel.module.css";

const LinkGerado = ({ url, nome, ong, onClose }) => {
  const [copiado, setCopiado] = useState(false);

  const mensagem =
    `Olá${
      nome ? `, ${nome}` : ""
    }! Este é o seu acesso ao painel do PeloPelo Maceió` +
    `${ong ? ` para gerenciar os pets da ${ong.nome}` : ""}. ` +
    `Abra o link e crie sua senha (vale por 24 horas e só pode ser usado uma vez): ${url}`;

  const copiar = async () => {
    await navigator.clipboard.writeText(mensagem);
    setCopiado(true);
  };

  return (
    <div className={styles.linkBox}>
      <strong>Link de acesso gerado{nome ? ` para ${nome}` : ""}</strong>
      <p>
        Envie para a pessoa. Ele vale por 24 horas e só pode ser usado uma vez.
      </p>
      <input readOnly value={url} onFocus={(e) => e.target.select()} />
      <div className={styles.actions}>
        <a
          className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noreferrer"
        >
          Enviar no WhatsApp
        </a>
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={copiar}
        >
          {copiado ? "Mensagem copiada!" : "Copiar mensagem"}
        </button>
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

const ConviteForm = ({ comFuncao, funcaoPadrao, onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { funcao: funcaoPadrao } });

  return (
    <form
      className={c(styles.form, styles.inlineForm)}
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className={styles.fieldRow}>
        <Field label="E-mail" error={errors.email}>
          <input type="email" {...register("email", { required: true })} />
        </Field>
        <Field label="Nome (opcional)">
          <input {...register("nome")} />
        </Field>
        {comFuncao && (
          <Field label="Função">
            <select className={styles.select} {...register("funcao")}>
              <option value="voluntario">{FuncaoMap.voluntario}</option>
              <option value="coordenacao">{FuncaoMap.coordenacao}</option>
            </select>
          </Field>
        )}
      </div>
      <div className={styles.actions}>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Gerando…" : "Gerar link de acesso"}
        </button>
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

// Lista quem acessa o painel por uma ONG (ou como admin) e permite convidar,
// gerar novo link (serve de "esqueci a senha"), mudar a função e remover.
// A coordenação só gere voluntários da própria ONG (a Edge Function confere).
export const Acessos = ({ perfis, papel, ong, onChange }) => {
  const { perfil: eu, isAdmin } = usePainel();
  const [link, setLink] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState(null);

  const comFuncao = papel === "ong";
  const podeGerir = (perfil) => isAdmin || perfil.funcao === "voluntario";

  const agir = async (acao) => {
    setErro(null);
    try {
      await acao();
      onChange();
    } catch (e) {
      setErro(e.message);
    }
  };

  // sem "funcao", o convidar mantém a função atual de quem já tem acesso
  const gerarLink = ({ email, nome, funcao }) =>
    agir(async () => {
      const { link: url } = await convidar({
        email,
        nome,
        papel,
        ongId: ong?.id,
        funcao: comFuncao ? funcao : undefined,
      });
      setLink({ url, nome });
      setFormAberto(false);
    });

  return (
    <>
      <div className={styles.userList}>
        {perfis.length === 0 && (
          <p className={styles.muted}>Ninguém tem acesso ainda.</p>
        )}
        {perfis.map((perfil) => (
          <div className={styles.userRow} key={perfil.user_id}>
            <span>
              <strong>{perfil.nome || perfil.email}</strong>{" "}
              {comFuncao && (
                <span className={c(styles.badge, styles[perfil.funcao])}>
                  {FuncaoMap[perfil.funcao]}
                </span>
              )}
              {perfil.nome && (
                <small className={styles.muted}>{perfil.email}</small>
              )}
            </span>
            <div className={styles.actions}>
              {podeGerir(perfil) && (
                <button
                  type="button"
                  className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                  onClick={() =>
                    gerarLink({ email: perfil.email, nome: perfil.nome })
                  }
                >
                  Novo link de acesso
                </button>
              )}
              {comFuncao && perfil.funcao === "voluntario" && (
                <ConfirmButton
                  className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                  confirmText="Confirmar: tornar coordenação"
                  onConfirm={() =>
                    agir(() => definirFuncao(perfil.user_id, "coordenacao"))
                  }
                >
                  Tornar coordenação
                </ConfirmButton>
              )}
              {comFuncao &&
                isAdmin &&
                perfil.funcao === "coordenacao" &&
                perfil.user_id !== eu.user_id && (
                  <ConfirmButton
                    className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                    confirmText="Confirmar: tornar voluntário(a)"
                    onConfirm={() =>
                      agir(() => definirFuncao(perfil.user_id, "voluntario"))
                    }
                  >
                    Tornar voluntário(a)
                  </ConfirmButton>
                )}
              {perfil.user_id !== eu.user_id && podeGerir(perfil) && (
                <ConfirmButton
                  className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                  confirmText="Confirmar remoção"
                  onConfirm={() => agir(() => removerAcesso(perfil.user_id))}
                >
                  Remover
                </ConfirmButton>
              )}
            </div>
          </div>
        ))}
      </div>

      <Alert tipo="error">{erro}</Alert>
      {link && <LinkGerado {...link} ong={ong} onClose={() => setLink(null)} />}

      {formAberto ? (
        <ConviteForm
          comFuncao={comFuncao}
          funcaoPadrao={isAdmin ? "coordenacao" : "voluntario"}
          onSubmit={gerarLink}
          onCancel={() => setFormAberto(false)}
        />
      ) : (
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={() => setFormAberto(true)}
        >
          + Convidar pessoa
        </button>
      )}
    </>
  );
};
