"use client";

import { useForm } from "react-hook-form";
import c from "clsx";
import { EspecieMap, SexoMap, SizeMap, StatusAnimalMap } from "@/utils";
import { Field } from "./ui";
import styles from "./Painel.module.css";

const SAUDE = [
  ["vacinado", "Vacina antirrábica"],
  ["vermifugado", "Vermifugado"],
  ["castrado", "Castrado"],
  ["especial", "Necessidades especiais"],
];

export const PetForm = ({ pet, ongs, onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: pet });

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.fieldRow}>
        <Field label="Nome" error={errors.nome}>
          <input
            placeholder="Ex.: Mel"
            {...register("nome", { required: true })}
          />
        </Field>
        {ongs && (
          <Field label="ONG" error={errors.ong_id}>
            <select
              className={styles.select}
              {...register("ong_id", { required: true })}
            >
              <option value="">Selecione…</option>
              {ongs.map((ong) => (
                <option key={ong.id} value={ong.id}>
                  {ong.nome}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className={styles.fieldRow}>
        <fieldset className={styles.fieldset}>
          <legend>Espécie</legend>
          <div className={styles.options}>
            {Object.keys(EspecieMap).map((valor) => (
              <label key={valor} className={styles.check}>
                <input type="radio" value={valor} {...register("especie")} />
                {valor === "cachorro" ? "Cachorro" : "Gato"}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>Sexo</legend>
          <div className={styles.options}>
            {Object.entries(SexoMap).map(([valor, rotulo]) => (
              <label key={valor} className={styles.check}>
                <input type="radio" value={valor} {...register("sexo")} />
                {rotulo}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={styles.fieldRow}>
        <Field label="Porte">
          <select className={styles.select} {...register("porte")}>
            {Object.entries(SizeMap).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Idade"
          hint="Ex.: 2 anos, 6 meses, filhote"
          error={errors.idade}
        >
          <input {...register("idade", { required: true })} />
        </Field>
        <Field label="Situação">
          <select className={styles.select} {...register("status")}>
            {Object.entries(StatusAnimalMap).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Saúde</legend>
        <div className={styles.options}>
          {SAUDE.map(([campo, rotulo]) => (
            <label key={campo} className={styles.check}>
              <input type="checkbox" {...register(campo)} />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Sobre o pet"
        hint="Personalidade, história do resgate, cuidados especiais… aparece na página do pet."
      >
        <textarea className={styles.textarea} {...register("descricao")} />
      </Field>

      <div className={styles.actions}>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary)}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Salvando…"
            : pet.id
            ? "Salvar alterações"
            : "Cadastrar pet"}
        </button>
      </div>
    </form>
  );
};
