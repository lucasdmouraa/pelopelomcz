"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import c from "clsx";
import { convidar, removerAcesso } from "@/services/painel";
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

const ConviteForm = ({ onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

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
// gerar novo link (serve de "esqueci a senha") e remover acesso.
export const Acessos = ({ perfis, papel, ong, onChange }) => {
  const { perfil: eu } = usePainel();
  const [link, setLink] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState(null);

  const gerarLink = async ({ email, nome }) => {
    setErro(null);
    try {
      const { link: url } = await convidar({
        email,
        nome,
        papel,
        ongId: ong?.id,
      });
      setLink({ url, nome });
      setFormAberto(false);
      onChange();
    } catch (e) {
      setErro(e.message);
    }
  };

  const remover = async (perfil) => {
    setErro(null);
    try {
      await removerAcesso(perfil.user_id);
      onChange();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <>
      <div className={styles.userList}>
        {perfis.length === 0 && (
          <p className={styles.muted}>Ninguém tem acesso ainda.</p>
        )}
        {perfis.map((perfil) => (
          <div className={styles.userRow} key={perfil.user_id}>
            <span>
              <strong>{perfil.nome || perfil.email}</strong>
              {perfil.nome && (
                <small className={styles.muted}>{perfil.email}</small>
              )}
            </span>
            <div className={styles.actions}>
              <button
                type="button"
                className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                onClick={() => gerarLink(perfil)}
              >
                Novo link de acesso
              </button>
              {perfil.user_id !== eu.user_id && (
                <ConfirmButton
                  className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                  confirmText="Confirmar remoção"
                  onConfirm={() => remover(perfil)}
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
