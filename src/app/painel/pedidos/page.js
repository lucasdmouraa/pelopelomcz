"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import c from "clsx";
import { Alert, usePainel } from "@/components/painel";
import { atualizarPedido, listarPedidos } from "@/services/painel";
import { StatusPedidoMap, formatDateTime } from "@/utils";
import styles from "@/components/painel/Painel.module.css";

const FILTROS = [
  ["abertos", "Em aberto"],
  ["concluido", "Concluídos"],
  ["recusado", "Não seguiram"],
  ["todos", "Todos"],
];

const noFiltro = (pedido, filtro) =>
  filtro === "todos" ||
  (filtro === "abertos"
    ? ["novo", "em_contato"].includes(pedido.status)
    : pedido.status === filtro);

const linkWhatsapp = (pedido) => {
  const numero = pedido.contact.replace(/\D/g, "");
  const mensagem =
    `Olá, ${pedido.name}! Aqui é da ${pedido.animal.ong.nome}. ` +
    `Recebemos pelo PeloPelo o seu interesse em adotar ${pedido.animal.nome} 🐾`;
  return `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`;
};

export default function PedidosPage() {
  const { isAdmin, recarregarPedidos } = usePainel();
  const [pedidos, setPedidos] = useState(null);
  const [filtro, setFiltro] = useState("abertos");
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      listarPedidos()
        .then(setPedidos)
        .catch((e) => setErro(e.message)),
    [],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atualizar = async (pedido, dados) => {
    setErro(null);
    setPedidos((atuais) =>
      atuais.map((p) => (p.id === pedido.id ? { ...p, ...dados } : p)),
    );
    try {
      await atualizarPedido(pedido.id, dados);
      recarregarPedidos();
    } catch (e) {
      setErro(e.message);
      carregar();
    }
  };

  const visiveis = pedidos?.filter((p) => noFiltro(p, filtro)) ?? [];

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Pedidos de adoção</h1>
      </div>
      <p className={styles.muted}>
        Os dados abaixo são pessoais (LGPD): use-os apenas para o processo de
        adoção.
      </p>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {FILTROS.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className={c(styles.tab, filtro === valor && styles.tabActive)}
              onClick={() => setFiltro(valor)}
            >
              {rotulo}
              <span>
                {pedidos?.filter((p) => noFiltro(p, valor)).length ?? ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Alert tipo="error">{erro}</Alert>
      {!pedidos && !erro && <p className={styles.muted}>Carregando…</p>}
      {pedidos && visiveis.length === 0 && (
        <div className={styles.empty}>Nenhum pedido por aqui.</div>
      )}

      {visiveis.map((pedido) => (
        <article key={pedido.id} className={c(styles.card, styles.pedido)}>
          <div className={styles.pedidoHeader}>
            <div>
              <p>
                <strong>{pedido.name}</strong> quer adotar{" "}
                <Link href={`/painel/pet?id=${pedido.animal.id}`}>
                  {pedido.animal.nome}
                </Link>
              </p>
              <span className={styles.muted}>
                {formatDateTime(pedido.created_at)}
                {isAdmin && ` · ${pedido.animal.ong.nome}`}
              </span>
            </div>
            <select
              aria-label="Andamento do pedido"
              className={c(styles.select, styles.badge, styles[pedido.status])}
              value={pedido.status}
              onChange={(e) => atualizar(pedido, { status: e.target.value })}
            >
              {Object.entries(StatusPedidoMap).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.dados}>
            <div>
              <span>Telefone</span>
              <strong>{pedido.contact}</strong>
            </div>
            <div>
              <span>CPF</span>
              <strong>{pedido.cpf}</strong>
            </div>
          </div>

          <textarea
            className={styles.textarea}
            aria-label="Anotações"
            placeholder="Anotações da ONG: entrevista, visita, termo assinado…"
            defaultValue={pedido.observacao ?? ""}
            onBlur={(e) =>
              e.target.value !== (pedido.observacao ?? "") &&
              atualizar(pedido, { observacao: e.target.value || null })
            }
          />

          <div className={styles.actions}>
            <a
              className={c(styles.btn, styles.btnPrimary, styles.btnSmall)}
              href={linkWhatsapp(pedido)}
              target="_blank"
              rel="noreferrer"
            >
              Conversar no WhatsApp
            </a>
          </div>
        </article>
      ))}
    </>
  );
}
