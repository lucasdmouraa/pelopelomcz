"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import c from "clsx";
import {
  apagarEvento,
  buscarFicha,
  listarEventos,
  registrarEvento,
} from "@/services/painel";
import { TipoEventoMap, dataLocal, formatDate } from "@/utils";
import { IconeEvento } from "./IconeEvento";
import { usePainel } from "./PainelShell";
import { Alert, ConfirmButton, Field } from "./ui";
import styles from "./Painel.module.css";

// Intervalo sugerido para o próximo reforço/retorno (dias)
const INTERVALO_SUGERIDO = { vacina: 365, vermifugo: 90, antipulgas: 30 };
const COM_PRODUTO = ["vacina", "vermifugo", "antipulgas", "exame", "outro"];
const COM_PROXIMA = ["vacina", "vermifugo", "antipulgas", "consulta", "outro"];

const hoje = () => dataLocal();
const somarDias = (data, dias) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
};
// datas "YYYY-MM-DD" vêm sem fuso: meio-dia evita virar o dia anterior
const meioDia = (data) => `${data}T12:00:00`;
const exibirData = (data) => formatDate(meioDia(data));
const diasAte = (data) =>
  Math.round((new Date(meioDia(data)) - new Date(meioDia(hoje()))) / 864e5);
const dinheiro = (valor) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quilos = (valor) =>
  `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
const registradoEm = (instante) =>
  new Date(instante).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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

// Monta os itens da linha do tempo: cadastro e entrada (da ficha), eventos de
// saúde, óbito e os lembretes ainda pendentes (previstos ou atrasados).
const montarLinha = (animal, ficha, eventos) => {
  const itens = [
    {
      chave: "cadastro",
      tipo: "cadastro",
      quando: ficha?.cadastrado_em ?? animal.created_at,
      titulo: "Cadastrado no painel",
      por: ficha?.cadastrado_por_nome,
      registrado: ficha?.cadastrado_em ?? animal.created_at,
    },
  ];
  if (ficha?.data_entrada) {
    itens.push({
      chave: "entrada",
      tipo: "entrada",
      quando: meioDia(ficha.data_entrada),
      titulo: "Chegou à ONG",
      detalhes: [ficha.origem_resgate, ficha.condicao_chegada],
    });
  }

  let pesoAnterior = null;
  [...eventos]
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
    .forEach((e) => {
      const detalhes = [e.descricao];
      if (e.tipo === "peso" && pesoAnterior) {
        const diferenca = Number(e.peso_kg) - Number(pesoAnterior.peso_kg);
        detalhes.unshift(
          diferenca === 0
            ? `Mesmo peso de ${exibirData(pesoAnterior.data)}`
            : `${diferenca > 0 ? "+" : "−"}${quilos(
                Math.abs(diferenca),
              )} desde ${exibirData(pesoAnterior.data)}`,
        );
      }
      if (e.tipo === "peso") pesoAnterior = e;
      itens.push({
        chave: `evento-${e.id}`,
        tipo: e.tipo,
        quando: meioDia(e.data),
        titulo:
          e.tipo === "peso"
            ? `Peso: ${quilos(e.peso_kg)}`
            : `${TipoEventoMap[e.tipo]}${e.produto ? ` · ${e.produto}` : ""}`,
        detalhes,
        valor: e.valor,
        por: e.registrado_por_nome,
        registrado: e.registrado_em,
        evento: e,
      });
      // lembrete pendente vira item previsto (ou atrasado) na data prevista
      if (e.proxima_data && !e.lembrete_resolvido) {
        const dias = diasAte(e.proxima_data);
        itens.push({
          chave: `previsto-${e.id}`,
          tipo: e.tipo,
          quando: meioDia(e.proxima_data),
          titulo: `${e.tipo === "consulta" ? "Retorno" : "Próxima dose"} · ${
            e.produto || TipoEventoMap[e.tipo]
          }`,
          detalhes: [
            dias < 0
              ? `Atrasada há ${-dias} dia(s)`
              : dias === 0
              ? "É hoje"
              : `Daqui a ${dias} dia(s)`,
          ],
          previsto: true,
          atrasado: dias < 0,
        });
      }
    });

  if (ficha?.data_obito) {
    itens.push({
      chave: "obito",
      tipo: "obito",
      quando: meioDia(ficha.data_obito),
      titulo: "Faleceu",
      detalhes: [ficha.causa_obito],
    });
  }
  return itens.sort((a, b) => new Date(a.quando) - new Date(b.quando));
};

// Linha do tempo de saúde do animal + registro de novos eventos.
export const SaudeEditor = ({ animal }) => {
  const { perfil, isCoordenacao } = usePainel();
  const [eventos, setEventos] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      Promise.all([listarEventos(animal.id), buscarFicha(animal.id)])
        .then(([lista, dadosFicha]) => {
          setEventos(lista);
          setFicha(dadosFicha);
        })
        .catch((e) => setErro(e.message)),
    [animal.id],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const registrar = async (dados) => {
    setErro(null);
    try {
      await registrarEvento(animal.id, dados);
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

  const itens = eventos ? montarLinha(animal, ficha, eventos) : [];

  return (
    <>
      <Alert tipo="error">{erro}</Alert>

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
        >
          + Registrar vacina, consulta, peso…
        </button>
      )}

      {!eventos && !erro && <p className={styles.muted}>Carregando…</p>}

      <ol className={styles.linha}>
        {itens.map((item, i) => {
          const podeApagar =
            item.evento &&
            (isCoordenacao || item.evento.registrado_por === perfil.user_id);
          return (
            <li
              key={item.chave}
              className={c(
                styles.linhaItem,
                i % 2 ? styles.linhaDireita : styles.linhaEsquerda,
                item.previsto && styles.linhaPrevisto,
                item.atrasado && styles.linhaAtrasado,
              )}
            >
              <span
                className={c(styles.linhaIcone, styles[`icone_${item.tipo}`])}
                title={TipoEventoMap[item.tipo] ?? item.titulo}
              >
                <IconeEvento tipo={item.tipo} />
              </span>
              <div className={styles.linhaCartao}>
                <span className={styles.linhaData}>
                  {formatDate(item.quando)}
                </span>
                <strong>{item.titulo}</strong>
                {item.detalhes?.filter(Boolean).map((texto) => (
                  <p key={texto}>{texto}</p>
                ))}
                {item.valor != null && (
                  <span className={styles.linhaValor}>
                    {dinheiro(item.valor)}
                  </span>
                )}
                {item.registrado && (
                  <small className={styles.muted}>
                    Registrado por {item.por ?? "—"} em{" "}
                    {registradoEm(item.registrado)}
                  </small>
                )}
                {podeApagar && (
                  <ConfirmButton
                    className={styles.linhaApagar}
                    confirmText="Apagar registro?"
                    onConfirm={() => apagar(item.evento)}
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
