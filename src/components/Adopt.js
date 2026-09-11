"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import InputMask from "react-input-mask";
import * as Dialog from "@radix-ui/react-dialog";

import { CloseIcon } from "./CloseIcon";
import { AdoptionSuccess } from "./AdoptionSuccess";
import { registerAdoptionRequest } from "@/services/supabase";
import styles from "./Adopt.module.css";

const getFormattedName = ({ nome, sexo }) =>
  `${sexo.toLowerCase() === "macho" ? "o" : "a"} ${nome}`;

export const Adopt = ({ pet }) => {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    control,
    reset,
  } = useForm();

  const onSubmit = ({ nome, contato, cpf }) => {
    const payload = { name: nome, contact: contato, cpf, pet_id: pet.id };
    registerAdoptionRequest(payload).then();
    setSubmitted(true);
  };

  const onOpenChange = (newState) => {
    reset();
    setOpen(newState);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button>Quero Adotar</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={styles.overlay} />
        <Dialog.Content class={styles.content}>
          <Dialog.Close asChild>
            <CloseIcon className={styles.close} />
          </Dialog.Close>
          {!submitted && (
            <div>
              <Dialog.Title class={styles.title}>Obaaa! AAUUUUU..</Dialog.Title>
              <Dialog.Description class={styles.description}>
                Saiba que {getFormattedName(pet)} já está muito
                {pet.sexo.toLowerCase() === "macho" ? " ansioso " : " ansiosa "}
                para te encontrar. Mas antes, precisamos de algumas informações
              </Dialog.Description>
              <form onSubmit={handleSubmit((data) => onSubmit(data))}>
                <span>
                  <span class={styles.labelContainer}>
                    <label htmlFor="nome">Seu Nome</label>
                    {errors?.nome && (
                      <p class={styles.errorMessage}>Campo Inválido</p>
                    )}
                  </span>

                  <Controller
                    control={control}
                    name="nome"
                    type="text"
                    rules={{
                      required: true,
                      pattern: {
                        value:
                          /\b[A-Za-zÀ-ú][A-Za-zÀ-ú]+,?\s[A-Za-zÀ-ú][A-Za-zÀ-ú]{2,19}\b/gi,
                      },
                    }}
                    render={({ field: { onChange, onBlur, ref } }) => (
                      <input
                        placeholder="DIGITE SEU NOME"
                        onBlur={onBlur}
                        onChange={onChange}
                        inputRef={ref}
                      />
                    )}
                  />
                </span>

                <span>
                  <span class={styles.labelContainer}>
                    <label htmlFor="cpf">Seu CPF</label>
                    {errors?.cpf && (
                      <p class={styles.errorMessage}>Campo Inválido</p>
                    )}
                  </span>

                  <Controller
                    control={control}
                    name="cpf"
                    type="number"
                    rules={{
                      required: true,
                      pattern: {
                        value:
                          /([0-9]{2}[\.]?[0-9]{3}[\.]?[0-9]{3}[\/]?[0-9]{4}[-]?[0-9]{2})|([0-9]{3}[\.]?[0-9]{3}[\.]?[0-9]{3}[-]?[0-9]{2})/,
                      },
                    }}
                    render={({ field: { onChange, onBlur, ref } }) => (
                      <InputMask
                        mask="999.999.999-99"
                        placeholder="000.000.000-00"
                        onBlur={onBlur}
                        onChange={onChange}
                        inputRef={ref}
                      />
                    )}
                  />
                </span>

                <span>
                  <span class={styles.labelContainer}>
                    <label htmlFor="contato">Contato</label>
                    {errors?.contato && (
                      <p class={styles.errorMessage}>Campo Inválido</p>
                    )}
                  </span>

                  <Controller
                    control={control}
                    name="contato"
                    type="number"
                    rules={{
                      required: true,
                      pattern: { value: /\(82\) 9 \d\d\d\d-\d\d\d\d/i },
                    }}
                    render={({ field: { onChange, onBlur, ref } }) => (
                      <InputMask
                        defaultValue="829"
                        mask="(99) 9 9999-9999"
                        placeholder="(82) 9 ____-____"
                        onBlur={onBlur}
                        onChange={onChange}
                        inputRef={ref}
                      />
                    )}
                  />
                </span>

                <button type="submit" class={styles.submit}>
                  Enviar Interesse
                </button>
              </form>
            </div>
          )}

          {submitted && <AdoptionSuccess />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
