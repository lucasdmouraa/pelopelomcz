"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import c from "clsx";
import { buscarFicha, salvarFicha } from "@/services/painel";
import { formatDateTime } from "@/utils";
import { Alert, Field } from "./ui";
import styles from "./Painel.module.css";

const CAMPOS = [
  "data_entrada",
  "nascimento_aproximado",
  "microchip",
  "origem_resgate",
  "condicao_chegada",
  "observacoes",
  "data_obito",
  "causa_obito",
];

// react-hook-form não aceita null em inputs controlados pelo DOM
const paraForm = (ficha) =>
  Object.fromEntries(CAMPOS.map((campo) => [campo, ficha?.[campo] ?? ""]));

const FichaForm = ({ ficha, falecido, onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: paraForm(ficha) });

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.fieldRow}>
        <Field label="Entrada na ONG">
          <input type="date" {...register("data_entrada")} />
        </Field>
        <Field label="Nascimento (aproximado)">
          <input type="date" {...register("nascimento_aproximado")} />
        </Field>
        <Field label="Microchip">
          <input {...register("microchip")} />
        </Field>
      </div>
      <Field
        label="Origem do resgate"
        hint="Onde e como foi resgatado. Não anote nome ou telefone de outras pessoas aqui."
      >
        <input {...register("origem_resgate")} />
      </Field>
      <Field label="Condição na chegada">
        <textarea
          className={styles.textarea}
          {...register("condicao_chegada")}
        />
      </Field>
      <Field
        label="Observações internas"
        hint="Só a equipe da ONG vê. Não aparece no site."
      >
        <textarea className={styles.textarea} {...register("observacoes")} />
      </Field>
      {falecido && (
        <div className={styles.fieldRow}>
          <Field label="Data do óbito">
            <input type="date" {...register("data_obito")} />
          </Field>
          <Field label="Causa">
            <input {...register("causa_obito")} />
          </Field>
        </div>
      )}
      <div className={styles.actions}>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando…" : "Salvar ficha"}
        </button>
      </div>
    </form>
  );
};

// Ficha interna do animal (entrada, resgate, microchip…): nunca vai ao site.
export const FichaEditor = ({ animalId, falecido }) => {
  const [ficha, setFicha] = useState(undefined);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    buscarFicha(animalId)
      .then(setFicha)
      .catch((e) => setErro(e.message));
  }, [animalId]);

  const salvar = async (dados) => {
    setErro(null);
    setAviso(null);
    try {
      setFicha(await salvarFicha(animalId, dados));
      setAviso("Ficha salva.");
    } catch (e) {
      setErro(e.message);
    }
  };

  if (ficha === undefined && !erro) {
    return <p className={styles.muted}>Carregando…</p>;
  }

  return (
    <>
      <Alert tipo="success">{aviso}</Alert>
      <Alert tipo="error">{erro}</Alert>
      <FichaForm
        key={ficha?.registrado_em ?? "nova"}
        ficha={ficha}
        falecido={falecido}
        onSubmit={salvar}
      />
      {ficha?.registrado_por_nome && (
        <p className={styles.muted} style={{ marginTop: 12 }}>
          Última atualização por {ficha.registrado_por_nome} em{" "}
          {formatDateTime(ficha.registrado_em)}.
        </p>
      )}
    </>
  );
};
