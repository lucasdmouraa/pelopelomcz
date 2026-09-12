"use client";

import { useCallback, useEffect, useState } from "react";
import c from "clsx";
import {
  abrirDocumento,
  apagarDocumento,
  enviarDocumento,
  listarDocumentos,
} from "@/services/painel";
import { TipoDocumentoMap, formatDate } from "@/utils";
import { usePainel } from "./PainelShell";
import { Alert, ConfirmButton } from "./ui";
import styles from "./Painel.module.css";

// Tipos que costumam ter dados pessoais (CPF, endereço): restritos por padrão
const RESTRITOS_POR_PADRAO = ["termo_adocao", "nota_fiscal"];

const tamanhoLegivel = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Documentos privados do animal (exames, receitas, termos…) no Storage.
export const DocumentosEditor = ({ animalId, ongId }) => {
  const { perfil, isCoordenacao } = usePainel();
  const [documentos, setDocumentos] = useState(null);
  const [tipo, setTipo] = useState("exame");
  const [restrito, setRestrito] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      listarDocumentos(animalId)
        .then(setDocumentos)
        .catch((e) => setErro(e.message)),
    [animalId],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mudarTipo = (valor) => {
    setTipo(valor);
    setRestrito(isCoordenacao && RESTRITOS_POR_PADRAO.includes(valor));
  };

  const enviar = async (event) => {
    const arquivos = [...event.target.files];
    event.target.value = "";
    setErro(null);
    const falhas = [];
    for (const [i, arquivo] of arquivos.entries()) {
      setProgresso(`Enviando ${i + 1} de ${arquivos.length}…`);
      try {
        await enviarDocumento({ animalId, ongId, arquivo, tipo, restrito });
      } catch (e) {
        falhas.push(e.message);
      }
    }
    setProgresso(null);
    if (falhas.length) setErro(falhas.join(" · "));
    carregar();
  };

  // abre a janela já no clique (senão o navegador bloqueia como pop-up) e só
  // depois busca a URL assinada, que vale 2 minutos
  const abrir = async (documento) => {
    const janela = window.open("", "_blank");
    try {
      janela.location = await abrirDocumento(documento.caminho);
    } catch (e) {
      janela?.close();
      setErro(e.message);
    }
  };

  const apagar = async (documento) => {
    setErro(null);
    try {
      await apagarDocumento(documento);
    } catch (e) {
      setErro(e.message);
    }
    carregar();
  };

  return (
    <>
      <p className={styles.muted}>
        Fotos de papel são reduzidas antes do envio. Aceita foto ou PDF de até 5
        MB. Nada aqui aparece no site.
      </p>
      <Alert tipo="error">{erro}</Alert>

      <div className={styles.actions} style={{ margin: "12px 0" }}>
        <select
          aria-label="Tipo do documento"
          className={styles.select}
          value={tipo}
          onChange={(e) => mudarTipo(e.target.value)}
        >
          {Object.entries(TipoDocumentoMap).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        {isCoordenacao && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={restrito}
              onChange={(e) => setRestrito(e.target.checked)}
            />
            Só a coordenação vê
          </label>
        )}
      </div>

      <div className={styles.actions}>
        <label className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={!!progresso}
            onChange={enviar}
          />
          Tirar foto
        </label>
        <label className={c(styles.btn, styles.btnGhost, styles.btnSmall)}>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            disabled={!!progresso}
            onChange={enviar}
          />
          Escolher arquivo
        </label>
        {progresso && <span className={styles.muted}>{progresso}</span>}
      </div>

      {!documentos && !erro && <p className={styles.muted}>Carregando…</p>}
      {documentos?.length === 0 && (
        <p className={styles.muted} style={{ marginTop: 12 }}>
          Nenhum documento guardado.
        </p>
      )}

      <div className={styles.userList}>
        {documentos?.map((documento) => (
          <div key={documento.id} className={styles.userRow}>
            <span>
              <strong>{TipoDocumentoMap[documento.tipo]}</strong> ·{" "}
              {documento.nome}{" "}
              {documento.restrito && (
                <span className={c(styles.badge, styles.coordenacao)}>
                  Restrito
                </span>
              )}
              <small className={styles.muted}>
                {tamanhoLegivel(documento.tamanho ?? 0)} ·{" "}
                {formatDate(documento.registrado_em)} · por{" "}
                {documento.registrado_por_nome ?? "—"}
              </small>
            </span>
            <div className={styles.actions}>
              <button
                type="button"
                className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                onClick={() => abrir(documento)}
              >
                Abrir
              </button>
              {(isCoordenacao ||
                documento.registrado_por === perfil.user_id) && (
                <ConfirmButton
                  className={styles.iconBtn}
                  confirmText="Apagar?"
                  onConfirm={() => apagar(documento)}
                  aria-label="Apagar documento"
                >
                  ✕
                </ConfirmButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
