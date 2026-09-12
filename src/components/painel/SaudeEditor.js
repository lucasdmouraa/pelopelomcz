"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import c from "clsx";
import {
  apagarEvento,
  listarEventos,
  registrarEvento,
} from "@/services/painel";
import { TipoEventoMap, formatDate } from "@/utils";
import { usePainel } from "./PainelShell";
import { Alert, ConfirmButton, Field } from "./ui";
import styles from "./Painel.module.css";

// Intervalo sugerido para o próximo reforço/retorno (dias)
const INTERVALO_SUGERIDO = { vacina: 365, vermifugo: 90, antipulgas: 30 };
const COM_PRODUTO = ["vacina", "vermifugo", "antipulgas", "exame", "outro"];
const COM_PROXIMA = ["vacina", "vermifugo", "antipulgas", "consulta", "outro"];

const hoje = () => new Date().toISOString().slice(0, 10);
const somarDias = (data, dias) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
// datas "YYYY-MM-DD" vêm sem fuso: meio-dia evita virar o dia anterior
const exibirData = (data) => formatDate(`${data}T12:00:00`);

const diasAte = (data) =>
  Math.round(
    (new Date(`${data}T12:00:00`) - new Date(`${hoje()}T12:00:00`)) / 864e5,
  );

const situacaoLembrete = (evento) => {
  if (!evento.proxima_data) return null;
  if (evento.lembrete_resolvido)
    return { classe: styles.recusado, texto: "resolvido" };
  const dias = diasAte(evento.proxima_data);
  if (dias < 0)
    return { classe: styles.vencido, texto: `vencido há ${-dias} dia(s)` };
  if (dias <= 7)
    return {
      classe: styles.em_processo,
      texto: dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`,
    };
  return { classe: styles.disponivel, texto: `em ${dias} dias` };
};

const EventoForm = ({ onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { tipo: "vacina", data: hoje() } });

  const tipo = watch("tipo");

  // sugere a próxima data quando o tipo tem intervalo conhecido
  useEffect(() => {
    const dias = INTERVALO_SUGERIDO[tipo];
    if (dias && !getValues("proxima_data")) {
      setValue("proxima_data", somarDias(getValues("data") || hoje(), dias));
    }
  }, [tipo, getValues, setValue]);

  return (
    <form
      className={c(styles.form, styles.inlineForm)}
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className={styles.fieldRow}>
        <Field label="Tipo">
          <select className={styles.select} {...register("tipo")}>
            {Object.entries(TipoEventoMap).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data" error={errors.data}>
          <input type="date" {...register("data", { required: true })} />
        </Field>
        {tipo === "peso" && (
          <Field label="Peso (kg)" error={errors.peso_kg}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              {...register("peso_kg", { required: true })}
            />
          </Field>
        )}
        {COM_PRODUTO.includes(tipo) && (
          <Field
            label={
              tipo === "vacina"
                ? "Vacina"
                : tipo === "exame"
                ? "Exame"
                : "Produto"
            }
          >
            <input
              placeholder={tipo === "vacina" ? "Ex.: V10, antirrábica" : ""}
              {...register("produto")}
            />
          </Field>
        )}
      </div>
      <Field label="Observações">
        <textarea className={styles.textarea} {...register("descricao")} />
      </Field>
      <div className={styles.fieldRow}>
        {COM_PROXIMA.includes(tipo) && (
          <Field
            label={tipo === "consulta" ? "Retorno" : "Próxima dose"}
            hint="Vira lembrete até ser registrado de novo."
          >
            <input type="date" {...register("proxima_data")} />
          </Field>
        )}
        <Field label="Valor (R$, opcional)">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            {...register("valor")}
          />
        </Field>
      </div>
      <div className={styles.actions}>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando…" : "Registrar"}
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

// Linha do tempo de saúde do animal + registro de novos eventos.
export const SaudeEditor = ({ animalId }) => {
  const { perfil, isCoordenacao } = usePainel();
  const [eventos, setEventos] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      listarEventos(animalId)
        .then(setEventos)
        .catch((e) => setErro(e.message)),
    [animalId],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const registrar = async (dados) => {
    setErro(null);
    try {
      await registrarEvento(animalId, dados);
      setFormAberto(false);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const apagar = async (evento) => {
    setErro(null);
    try {
      await apagarEvento(evento.id);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const pendentes = eventos?.filter(
    (e) => e.proxima_data && !e.lembrete_resolvido,
  );

  return (
    <>
      <Alert tipo="error">{erro}</Alert>
      {pendentes?.length > 0 && (
        <div className={c(styles.alert, styles.warn)}>
          <span>
            <strong>Próximos:</strong>{" "}
            {pendentes
              .map(
                (e) =>
                  `${e.produto || TipoEventoMap[e.tipo]} em ${exibirData(
                    e.proxima_data,
                  )}`,
              )
              .join(" · ")}
          </span>
        </div>
      )}

      {formAberto ? (
        <EventoForm
          onSubmit={registrar}
          onCancel={() => setFormAberto(false)}
        />
      ) : (
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={() => setFormAberto(true)}
          style={{ marginTop: 12 }}
        >
          + Registrar vacina, consulta, peso…
        </button>
      )}

      {!eventos && !erro && <p className={styles.muted}>Carregando…</p>}
      {eventos?.length === 0 && (
        <p className={styles.muted} style={{ marginTop: 12 }}>
          Nenhum registro de saúde ainda.
        </p>
      )}

      <ol className={styles.timeline}>
        {eventos?.map((evento) => {
          const lembrete = situacaoLembrete(evento);
          const podeApagar =
            isCoordenacao || evento.registrado_por === perfil.user_id;
          return (
            <li key={evento.id} className={styles.timelineItem}>
              <div className={styles.timelineHeader}>
                <span>
                  <strong>{TipoEventoMap[evento.tipo]}</strong>
                  {evento.produto && ` · ${evento.produto}`}
                  {evento.peso_kg &&
                    ` · ${Number(evento.peso_kg).toLocaleString("pt-BR")} kg`}
                </span>
                <span className={styles.muted}>{exibirData(evento.data)}</span>
              </div>
              {evento.descricao && <p>{evento.descricao}</p>}
              <div className={styles.timelineFooter}>
                {lembrete && (
                  <span className={c(styles.badge, lembrete.classe)}>
                    {evento.tipo === "consulta" ? "Retorno" : "Próxima"}{" "}
                    {exibirData(evento.proxima_data)} · {lembrete.texto}
                  </span>
                )}
                {evento.valor != null && (
                  <span className={styles.muted}>
                    R${" "}
                    {Number(evento.valor).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                )}
                <span className={styles.muted}>
                  por {evento.registrado_por_nome ?? "—"}
                </span>
                {podeApagar && (
                  <ConfirmButton
                    className={styles.iconBtn}
                    confirmText="Apagar?"
                    onConfirm={() => apagar(evento)}
                    aria-label="Apagar registro"
                  >
                    ✕
                  </ConfirmButton>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
};
