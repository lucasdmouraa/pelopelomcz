"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import c from "clsx";
import { Alert, DoseLinha, usePainel } from "@/components/painel";
import {
  apagarDose,
  contarPedidosNovos,
  dosesPrevistas,
  listarVencimentos,
  registrarDose,
} from "@/services/painel";
import { TipoEventoMap, dataLocal, formatDate } from "@/utils";
import styles from "@/components/painel/Painel.module.css";

const DIA = 864e5;
// datas "YYYY-MM-DD" vêm sem fuso: meio-dia evita virar o dia anterior
const exibirData = (data) => formatDate(`${data}T12:00:00`);
const hojeISO = () => dataLocal();

// Tela do turno: doses do dia (com quem deu), vacinas vencendo e pedidos novos.
export default function HojePage() {
  const { isCoordenacao } = usePainel();
  const [doses, setDoses] = useState(null);
  const [vencimentos, setVencimentos] = useState(null);
  const [pedidosNovos, setPedidosNovos] = useState(0);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const fimDoDia = new Date();
      fimDoDia.setHours(24, 0, 0, 0);
      // últimas 24h: a dose das 23h ainda aparece se alguém abrir à 0h30
      const [previstas, pendentes] = await Promise.all([
        dosesPrevistas(Date.now() - DIA, fimDoDia),
        listarVencimentos(7),
      ]);
      setDoses(previstas);
      setVencimentos(pendentes);
      if (isCoordenacao) setPedidosNovos(await contarPedidosNovos());
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e.message);
    }
  }, [isCoordenacao]);

  useEffect(() => {
    carregar();
    // várias pessoas no mesmo turno: a lista se atualiza sozinha
    const timer = setInterval(carregar, 60e3);
    return () => clearInterval(timer);
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

  const marcar = (dose, pulada) =>
    agir(() =>
      registrarDose({
        tratamentoId: dose.tratamento_id,
        previstoPara: dose.previsto_para,
        pulada,
      }),
    );
  const desfazer = (dose) => agir(() => apagarDose(dose.dose_id));

  const agora = new Date();
  const pendentes = doses?.filter((d) => !d.dose_id) ?? [];
  const grupos = [
    ["Atrasadas", pendentes.filter((d) => new Date(d.previsto_para) < agora)],
    ["Próximas", pendentes.filter((d) => new Date(d.previsto_para) >= agora)],
    ["Registradas", doses?.filter((d) => d.dose_id).reverse() ?? []],
  ];

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Hoje</h1>
        <button
          type="button"
          className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          onClick={carregar}
        >
          Atualizar
        </button>
      </div>

      {isCoordenacao && pedidosNovos > 0 && (
        <div className={c(styles.alert, styles.info)}>
          <span>
            {pedidosNovos === 1
              ? "1 pedido de adoção novo."
              : `${pedidosNovos} pedidos de adoção novos.`}
          </span>
          <Link
            href="/painel/pedidos"
            className={c(styles.btn, styles.btnSmall)}
          >
            Ver pedidos
          </Link>
        </div>
      )}
      <Alert tipo="error">{erro}</Alert>

      <section className={styles.card}>
        <h2>Remédios</h2>
        {!doses && !erro && <p className={styles.muted}>Carregando…</p>}
        {doses?.length === 0 && (
          <p className={styles.muted}>
            Nenhuma dose prevista. Os horários aparecem aqui quando um
            tratamento é cadastrado na página do pet.
          </p>
        )}
        {grupos.map(
          ([titulo, lista]) =>
            lista.length > 0 && (
              <div key={titulo} className={styles.userList}>
                <strong>
                  {titulo} ({lista.length})
                </strong>
                {lista.map((dose) => (
                  <DoseLinha
                    key={`${dose.tratamento_id}-${dose.previsto_para}`}
                    dose={dose}
                    mostrarAnimal
                    onMarcar={marcar}
                    onDesfazer={desfazer}
                  />
                ))}
              </div>
            ),
        )}
      </section>

      <section className={styles.card}>
        <h2>Vacinas e cuidados vencendo</h2>
        {vencimentos?.length === 0 && (
          <p className={styles.muted}>Nada vencendo nos próximos 7 dias.</p>
        )}
        <div className={styles.userList}>
          {vencimentos?.map((v) => (
            <div key={v.id} className={styles.userRow}>
              <span>
                <strong>{v.animal_nome}</strong> ·{" "}
                {v.produto || TipoEventoMap[v.tipo]}
                <small
                  className={c(
                    styles.badge,
                    v.proxima_data < hojeISO()
                      ? styles.vencido
                      : styles.em_processo,
                  )}
                >
                  {v.proxima_data < hojeISO() ? "venceu em" : "vence em"}{" "}
                  {exibirData(v.proxima_data)}
                </small>
              </span>
              <Link
                href={`/painel/pet?id=${v.animal_id}`}
                className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
              >
                Registrar
              </Link>
            </div>
          ))}
        </div>
        {vencimentos?.length > 0 && (
          <p className={styles.muted}>
            Registre o reforço na seção Saúde do pet: o aviso sai daqui sozinho.
          </p>
        )}
      </section>

      {atualizadoEm && (
        <p className={styles.muted} style={{ marginTop: 16 }}>
          Atualizado às{" "}
          {atualizadoEm.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          . A lista se atualiza sozinha a cada minuto.
        </p>
      )}
    </>
  );
}
