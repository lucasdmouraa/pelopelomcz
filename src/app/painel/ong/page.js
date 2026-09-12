"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import c from "clsx";
import { Alert, Field, usePainel } from "@/components/painel";
import { buscarOng, enviarLogo, salvarOng } from "@/services/painel";
import { PLACEHOLDER_IMAGE } from "@/services/cloudinary";
import { slugify } from "@/utils";
import styles from "@/components/painel/Painel.module.css";

const NOVA_ONG = {
  nome: "",
  slug: "",
  descricao: "",
  instagram: "",
  site: "",
  whatsapp: "",
  email: "",
  ativa: true,
};

const semNulos = (ong) =>
  Object.fromEntries(Object.entries(ong).map(([k, v]) => [k, v ?? ""]));

const OngForm = ({ ong, isAdmin, onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: ong });

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.fieldRow}>
        <Field label="Nome da ONG" error={errors.nome}>
          <input {...register("nome", { required: true })} />
        </Field>
        {isAdmin && !ong.id && (
          <Field
            label="Identificador"
            hint="Deixe em branco para gerar a partir do nome (ex.: pata-amada)."
          >
            <input {...register("slug")} />
          </Field>
        )}
      </div>
      <Field label="Sobre a ONG">
        <textarea className={styles.textarea} {...register("descricao")} />
      </Field>
      <div className={styles.fieldRow}>
        <Field label="Link do Instagram" hint="https://www.instagram.com/…">
          <input type="url" {...register("instagram")} />
        </Field>
        <Field label="Outro site">
          <input type="url" {...register("site")} />
        </Field>
      </div>
      <div className={styles.fieldRow}>
        <Field label="WhatsApp">
          <input
            type="tel"
            placeholder="(82) 9 0000-0000"
            {...register("whatsapp")}
          />
        </Field>
        <Field label="E-mail">
          <input type="email" {...register("email")} />
        </Field>
      </div>
      {isAdmin && (
        <label className={styles.check}>
          <input type="checkbox" {...register("ativa")} />
          ONG ativa (aparece nos parceiros e seus pets aparecem no site)
        </label>
      )}
      <div className={styles.actions}>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary)}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Salvando…"
            : ong.id
            ? "Salvar alterações"
            : "Cadastrar ONG"}
        </button>
      </div>
    </form>
  );
};

const Logo = ({ ong, onChange }) => {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const enviar = async (event) => {
    const [arquivo] = event.target.files;
    event.target.value = "";
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      await enviarLogo(ong.id, arquivo);
      onChange();
    } catch (e) {
      setErro(e.message);
    }
    setEnviando(false);
  };

  return (
    <div className={styles.form}>
      <img
        className={styles.logoPreview}
        src={ong.logo_url || PLACEHOLDER_IMAGE}
        alt=""
      />
      <Alert tipo="error">{erro}</Alert>
      <label
        className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
        style={{ width: "fit-content" }}
      >
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={enviar}
          disabled={enviando}
        />
        {enviando ? "Enviando…" : "Trocar logo"}
      </label>
    </div>
  );
};

const OngEditor = () => {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { perfil, isAdmin, recarregarPerfil } = usePainel();
  // ONG sempre edita a própria; só o admin escolhe (ou cria) pelo ?id=
  const ongId = isAdmin ? (id ? Number(id) : null) : perfil.ong_id;
  const [ong, setOng] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = () =>
    buscarOng(ongId)
      .then((dados) => setOng(semNulos(dados)))
      .catch(() => setErro("ONG não encontrada."));

  useEffect(() => {
    if (ongId) carregar();
    else setOng(NOVA_ONG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongId]);

  const salvar = async (dados) => {
    setErro(null);
    setAviso(null);
    try {
      const salva = await salvarOng(
        {
          ...dados,
          id: ong.id,
          slug: dados.slug?.trim() || slugify(dados.nome),
        },
        isAdmin,
      );
      setOng(semNulos(salva));
      if (ong.id === perfil.ong_id) recarregarPerfil();
      if (ong.id) setAviso("Alterações salvas.");
      else {
        setAviso(
          "ONG cadastrada! Envie a logo e convide as pessoas em “ONGs e acessos”.",
        );
        router.replace(`/painel/ong?id=${salva.id}`);
      }
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          {isAdmin && (
            <Link href="/painel/ongs" className={styles.back}>
              ← ONGs
            </Link>
          )}
          <h1>{ong?.id ? ong.nome : ong ? "Nova ONG" : "ONG"}</h1>
        </div>
      </div>

      <Alert tipo="success">{aviso}</Alert>
      <Alert tipo="error">{erro}</Alert>
      {!ong && !erro && <p className={styles.muted}>Carregando…</p>}

      {ong && (
        <>
          <section className={styles.card}>
            <h2>Perfil</h2>
            <OngForm
              key={ong.id ?? "nova"}
              ong={ong}
              isAdmin={isAdmin}
              onSubmit={salvar}
            />
          </section>
          {ong.id && (
            <section className={styles.card}>
              <h2>Logo</h2>
              <Logo ong={ong} onChange={carregar} />
            </section>
          )}
        </>
      )}
    </>
  );
};

export default function OngPage() {
  return (
    <Suspense>
      <OngEditor />
    </Suspense>
  );
}
