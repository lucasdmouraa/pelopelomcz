"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import c from "clsx";
import { Alert, Field, usePainel } from "@/components/painel";
import { entrar } from "@/services/painel";
import styles from "@/components/painel/Painel.module.css";

export default function LoginPage() {
  const { session } = usePainel();
  const router = useRouter();
  const [erro, setErro] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  useEffect(() => {
    if (session) router.replace("/painel");
  }, [session, router]);

  const onSubmit = async ({ email, senha }) => {
    setErro(null);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className={styles.authCard}>
      <img src="/1.webp" className={styles.authLogo} alt="" />
      <h1>Painel PeloPelo</h1>
      <p className={styles.muted}>
        Acesso para ONGs parceiras e administradores.
      </p>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Field label="E-mail">
          <input
            type="email"
            autoComplete="email"
            {...register("email", { required: true })}
          />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            autoComplete="current-password"
            {...register("senha", { required: true })}
          />
        </Field>
        <Alert tipo="error">{erro}</Alert>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className={styles.muted}>
        Esqueceu a senha ou ainda não tem acesso? Peça um link de acesso ao
        administrador do PeloPelo.
      </p>
    </div>
  );
}
