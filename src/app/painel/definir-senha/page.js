"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import c from "clsx";
import { Alert, Field, usePainel } from "@/components/painel";
import { definirSenha, validarLink } from "@/services/painel";
import styles from "@/components/painel/Painel.module.css";

// Destino do link de acesso gerado pelo admin (?token_hash=…&type=invite|recovery).
// O token só é validado no envio do formulário, para que prévias de link do
// WhatsApp não o consumam.
const DefinirSenha = () => {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const tipo = params.get("type");
  const { session } = usePainel();
  const router = useRouter();
  const linkValidado = useRef(false);
  const [erro, setErro] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ senha, confirmacao }) => {
    setErro(null);
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    try {
      if (tokenHash && !linkValidado.current) {
        await validarLink(tokenHash, tipo);
        linkValidado.current = true;
      }
      await definirSenha(senha);
      router.replace("/painel");
    } catch (e) {
      setErro(e.message);
    }
  };

  if (!tokenHash && session === undefined) {
    return <div className={styles.authCard}>Carregando…</div>;
  }

  if (!tokenHash && !session) {
    return (
      <div className={styles.authCard}>
        <h1>Link inválido</h1>
        <p>
          Este endereço precisa do link de acesso enviado pelo administrador do
          PeloPelo. Peça um novo link se o seu expirou.
        </p>
        <Link href="/painel/login" className={c(styles.btn, styles.btnGhost)}>
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.authCard}>
      <img src="/1.webp" className={styles.authLogo} alt="" />
      <h1>
        {tipo === "invite" ? "Boas-vindas ao PeloPelo!" : "Criar nova senha"}
      </h1>
      <p className={styles.muted}>
        Crie uma senha para acessar o painel. Ela precisa ter pelo menos 8
        caracteres.
      </p>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Field label="Nova senha" error={errors.senha}>
          <input
            type="password"
            autoComplete="new-password"
            {...register("senha", {
              required: true,
              minLength: { value: 8, message: "Use pelo menos 8 caracteres" },
            })}
          />
        </Field>
        <Field label="Repita a senha" error={errors.confirmacao}>
          <input
            type="password"
            autoComplete="new-password"
            {...register("confirmacao", { required: true })}
          />
        </Field>
        <Alert tipo="error">{erro}</Alert>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando…" : "Salvar senha e entrar"}
        </button>
      </form>
    </div>
  );
};

export default function DefinirSenhaPage() {
  return (
    <Suspense>
      <DefinirSenha />
    </Suspense>
  );
}
