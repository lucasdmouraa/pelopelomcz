"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import c from "clsx";
import {
  apagarDose,
  criarTratamento,
  dosesPrevistas,
  encerrarTratamento,
  listarTratamentos,
  registrarDose,
  substituirTratamento,
} from "@/services/painel";
import { ViaMap, formatDate } from "@/utils";
import { usePainel } from "./PainelShell";
import { Alert, ConfirmButton, Field } from "./ui";
import styles from "./Painel.module.css";

const INTERVALOS = [
  [1, "Todo dia"],
  [2, "A cada 2 dias"],
  [3, "A cada 3 dias"],
  [7, "Uma vez por semana"],
];

const DIA = 864e5;
const hora = (valor) =>
  new Date(valor).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

// "08:00, 20h00 e 14:30" → ["08:00", "14:30", "20:00"]
const lerHorarios = (texto) =>
  [
    ...new Set(
      (texto.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g) ?? []).map((h) =>
        h.replace("h", ":").padStart(5, "0"),
      ),
    ),
  ].sort();

// valor para <input type="datetime-local"> no fuso do navegador
const paraInputLocal = (data) =>
  new Date(data.getTime() - data.getTimezoneOffset() * 6e4)
    .toISOString()
    .slice(0, 16);

const estaAtivo = (t) => !t.fim || new Date(t.fim) > new Date();

const descreverAgenda = (t) => {
  if (!t.horarios.length) return "Se necessário";
  const horas = t.horarios.map((h) => h.slice(0, 5)).join(", ");
  const frequencia =
    INTERVALOS.find(([dias]) => dias === t.intervalo_dias)?.[1] ??
    `A cada ${t.intervalo_dias} dias`;
  return `${horas} · ${frequencia.toLowerCase()}`;
};

const valoresDoForm = (tratamento) => {
  if (!tratamento) {
    return {
      medicamento: "",
      dose: "",
      via: "oral",
      horarios: "",
      intervalo_dias: "1",
      inicio: paraInputLocal(new Date()),
      duracao: "continuo",
      dias: "7",
      instrucoes: "",
    };
  }
  // "Alterar": a nova agenda começa agora, com o que ainda falta do período
  const restante = tratamento.fim
    ? Math.max(1, Math.ceil((new Date(tratamento.fim) - Date.now()) / DIA))
    : null;
  return {
    medicamento: tratamento.medicamento,
    dose: tratamento.dose ?? "",
    via: tratamento.via ?? "oral",
    horarios: tratamento.horarios.map((h) => h.slice(0, 5)).join(", "),
    intervalo_dias: String(tratamento.intervalo_dias),
    inicio: paraInputLocal(new Date()),
    duracao: restante ? "dias" : "continuo",
    dias: String(restante ?? 7),
    instrucoes: tratamento.instrucoes ?? "",
  };
};

const paraBanco = (dados) => {
  const horarios = lerHorarios(dados.horarios);
  if (dados.horarios.trim() && !horarios.length) {
    throw new Error("Horários inválidos. Use o formato 08:00, 20:00.");
  }
  const inicio = new Date(dados.inicio);
  const fim =
    dados.duracao === "dias"
      ? new Date(inicio.getTime() + Number(dados.dias) * DIA)
      : null;
  return {
    medicamento: dados.medicamento.trim(),
    dose: dados.dose.trim() || null,
    via: dados.via || null,
    instrucoes: dados.instrucoes.trim() || null,
    horarios,
    intervalo_dias: Number(dados.intervalo_dias),
    inicio: inicio.toISOString(),
    fim: fim?.toISOString() ?? null,
  };
};

const TratamentoForm = ({ tratamento, onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: valoresDoForm(tratamento) });
  const duracao = watch("duracao");

  return (
    <form
      className={c(styles.form, styles.inlineForm)}
      onSubmit={handleSubmit(onSubmit)}
    >
      {tratamento && (
        <p className={styles.muted}>
          O tratamento atual será encerrado agora e este começa no lugar dele.
          As doses já registradas continuam no histórico.
        </p>
      )}
      <div className={styles.fieldRow}>
        <Field label="Remédio" error={errors.medicamento}>
          <input {...register("medicamento", { required: true })} />
        </Field>
        <Field label="Dose">
          <input
            placeholder="Ex.: 1 comprimido, 2 ml, 1 gota"
            {...register("dose")}
          />
        </Field>
        <Field label="Via">
          <select className={styles.select} {...register("via")}>
            {Object.entries(ViaMap).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={styles.fieldRow}>
        <Field
          label="Horários"
          hint="Ex.: 08:00, 20:00. Deixe vazio para “se necessário”."
        >
          <input inputMode="numeric" {...register("horarios")} />
        </Field>
        <Field label="Frequência">
          <select className={styles.select} {...register("intervalo_dias")}>
            {INTERVALOS.map(([dias, rotulo]) => (
              <option key={dias} value={dias}>
                {rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Começa em" error={errors.inicio}>
          <input
            type="datetime-local"
            {...register("inicio", { required: true })}
          />
        </Field>
      </div>
      <fieldset className={styles.fieldset}>
        <legend>Duração</legend>
        <div className={styles.options}>
          <label className={styles.check}>
            <input type="radio" value="continuo" {...register("duracao")} />
            Uso contínuo
          </label>
          <label className={styles.check}>
            <input type="radio" value="dias" {...register("duracao")} />
            Por
            <input
              type="number"
              min="1"
              max="365"
              style={{ width: 80 }}
              disabled={duracao !== "dias"}
              {...register("dias")}
            />
            dias
          </label>
        </div>
      </fieldset>
      <Field label="Instruções">
        <textarea
          className={styles.textarea}
          placeholder="Ex.: dar com comida, agitar antes de usar"
          {...register("instrucoes")}
        />
      </Field>
      <div className={styles.actions}>
        <button
          type="submit"
          className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Salvando…"
            : tratamento
            ? "Salvar nova agenda"
            : "Cadastrar tratamento"}
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

// Linha de uma dose prevista: pendente (Dei / Pulei) ou registrada.
export const DoseLinha = ({ dose, mostrarAnimal, onMarcar, onDesfazer }) => {
  const { perfil, isCoordenacao } = usePainel();
  const atrasada = !dose.dose_id && new Date(dose.previsto_para) < new Date();
  const podeDesfazer =
    dose.dose_id &&
    (isCoordenacao ||
      (dose.dada_por === perfil.user_id &&
        Date.now() - new Date(dose.dose_registrada_em) < 15 * 6e4));

  return (
    <div className={styles.userRow}>
      <span>
        <strong>{hora(dose.previsto_para)}</strong>{" "}
        {mostrarAnimal && <strong>{dose.animal_nome} · </strong>}
        {dose.medicamento}
        {dose.dose && ` · ${dose.dose}`}
        {dose.via && ` · ${ViaMap[dose.via] ?? dose.via}`}
        {dose.instrucoes && (
          <small className={styles.muted}>{dose.instrucoes}</small>
        )}
      </span>
      <div className={styles.actions}>
        {dose.dose_id ? (
          <>
            <span
              className={c(
                styles.badge,
                dose.pulada ? styles.recusado : styles.disponivel,
              )}
            >
              {dose.pulada ? "Pulada" : "✓ Dada"} por{" "}
              {dose.dada_por_nome ?? "—"} às {hora(dose.dada_em)}
            </span>
            {podeDesfazer && (
              <button
                type="button"
                className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                onClick={() => onDesfazer(dose)}
              >
                Desfazer
              </button>
            )}
          </>
        ) : (
          <>
            {atrasada && (
              <span className={c(styles.badge, styles.vencido)}>atrasada</span>
            )}
            <button
              type="button"
              className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
              onClick={() => onMarcar(dose, false)}
            >
              Dei
            </button>
            <ConfirmButton
              className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
              confirmText="Confirmar: pulei"
              onConfirm={() => onMarcar(dose, true)}
            >
              Pulei
            </ConfirmButton>
          </>
        )}
      </div>
    </div>
  );
};

// Tratamentos do animal + doses de hoje.
export const RemediosEditor = ({ animalId }) => {
  const [tratamentos, setTratamentos] = useState(null);
  const [doses, setDoses] = useState([]);
  const [form, setForm] = useState(null); // null | { tratamento?: t }
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const inicioDoDia = new Date();
      inicioDoDia.setHours(0, 0, 0, 0);
      const fimDoDia = new Date(inicioDoDia.getTime() + DIA);
      const [lista, previstas] = await Promise.all([
        listarTratamentos(animalId),
        dosesPrevistas(inicioDoDia, fimDoDia, animalId),
      ]);
      setTratamentos(lista);
      setDoses(previstas);
    } catch (e) {
      setErro(e.message);
    }
  }, [animalId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const agir = async (acao) => {
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e.message);
    }
    carregar();
  };

  const salvar = (dados) =>
    agir(async () => {
      const novo = paraBanco(dados);
      if (form.tratamento) await substituirTratamento(form.tratamento, novo);
      else await criarTratamento(animalId, novo);
      setForm(null);
    });

  const ativos = tratamentos?.filter(estaAtivo) ?? [];
  const encerrados = tratamentos?.filter((t) => !estaAtivo(t)) ?? [];

  return (
    <>
      <Alert tipo="error">{erro}</Alert>

      {doses.length > 0 && (
        <div className={styles.userList}>
          <strong>Doses de hoje</strong>
          {doses.map((dose) => (
            <DoseLinha
              key={`${dose.tratamento_id}-${dose.previsto_para}`}
              dose={dose}
              onMarcar={(d, pulada) =>
                agir(() =>
                  registrarDose({
                    tratamentoId: d.tratamento_id,
                    previstoPara: d.previsto_para,
                    pulada,
                  }),
                )
              }
              onDesfazer={(d) => agir(() => apagarDose(d.dose_id))}
            />
          ))}
        </div>
      )}

      {!tratamentos && !erro && <p className={styles.muted}>Carregando…</p>}
      {tratamentos?.length === 0 && !form && (
        <p className={styles.muted}>Nenhum tratamento cadastrado.</p>
      )}

      <ol className={styles.timeline}>
        {ativos.map((t) => (
          <li key={t.id} className={styles.timelineItem}>
            <div className={styles.timelineHeader}>
              <span>
                <strong>{t.medicamento}</strong>
                {t.dose && ` · ${t.dose}`}
                {t.via && ` · ${ViaMap[t.via] ?? t.via}`}
              </span>
              <span className={styles.muted}>
                desde {formatDate(t.inicio)}
                {t.fim ? ` até ${formatDate(t.fim)}` : " · contínuo"}
              </span>
            </div>
            <span>{descreverAgenda(t)}</span>
            {t.instrucoes && <p>{t.instrucoes}</p>}
            <div className={styles.timelineFooter}>
              {t.horarios.length === 0 && (
                <button
                  type="button"
                  className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
                  onClick={() =>
                    agir(() =>
                      registrarDose({ tratamentoId: t.id, previstoPara: null }),
                    )
                  }
                >
                  Registrar dose agora
                </button>
              )}
              <button
                type="button"
                className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                onClick={() => setForm({ tratamento: t })}
              >
                Alterar
              </button>
              <ConfirmButton
                className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                confirmText="Confirmar: encerrar"
                onConfirm={() => agir(() => encerrarTratamento(t.id))}
              >
                Encerrar
              </ConfirmButton>
              <span className={styles.muted}>
                por {t.registrado_por_nome ?? "—"}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {form ? (
        <TratamentoForm
          key={form.tratamento?.id ?? "novo"}
          tratamento={form.tratamento}
          onSubmit={salvar}
          onCancel={() => setForm(null)}
        />
      ) : (
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={() => setForm({})}
          style={{ marginTop: 12 }}
        >
          + Novo tratamento
        </button>
      )}

      {encerrados.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
            onClick={() => setVerEncerrados(!verEncerrados)}
          >
            {verEncerrados ? "Ocultar" : "Ver"} encerrados ({encerrados.length})
          </button>
          {verEncerrados && (
            <ol className={styles.timeline}>
              {encerrados.map((t) => (
                <li key={t.id} className={styles.timelineItem}>
                  <span>
                    <strong>{t.medicamento}</strong>
                    {t.dose && ` · ${t.dose}`} · {descreverAgenda(t)}
                  </span>
                  <span className={styles.muted}>
                    {formatDate(t.inicio)} a {formatDate(t.fim)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
};
