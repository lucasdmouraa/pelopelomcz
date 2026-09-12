"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import c from "clsx";
import { Acessos, Alert, usePainel } from "@/components/painel";
import { listarOngs, listarPerfis } from "@/services/painel";
import { PLACEHOLDER_IMAGE } from "@/services/cloudinary";
import styles from "@/components/painel/Painel.module.css";

export default function OngsPage() {
  const { isAdmin } = usePainel();
  const [ongs, setOngs] = useState(null);
  const [perfis, setPerfis] = useState([]);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      Promise.all([listarOngs(), listarPerfis()])
        .then(([listaOngs, listaPerfis]) => {
          setOngs(listaOngs);
          setPerfis(listaPerfis);
        })
        .catch((e) => setErro(e.message)),
    [],
  );

  useEffect(() => {
    if (isAdmin) carregar();
  }, [isAdmin, carregar]);

  if (!isAdmin) {
    return <Alert tipo="error">Página exclusiva do administrador.</Alert>;
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>ONGs e acessos</h1>
        <Link href="/painel/ong" className={c(styles.btn, styles.btnPrimary)}>
          + Nova ONG
        </Link>
      </div>

      <Alert tipo="error">{erro}</Alert>
      {!ongs && !erro && <p className={styles.muted}>Carregando…</p>}

      {ongs?.map((ong) => (
        <section key={ong.id} className={styles.card}>
          <div className={styles.ongHeader}>
            <img
              className={styles.ongLogo}
              src={ong.logo_url || PLACEHOLDER_IMAGE}
              alt=""
            />
            <div>
              <h2>{ong.nome}</h2>
              <span
                className={c(
                  styles.badge,
                  ong.ativa ? styles.disponivel : styles.inativa,
                )}
              >
                {ong.ativa ? "Ativa" : "Inativa"}
              </span>
            </div>
            <Link
              href={`/painel/ong?id=${ong.id}`}
              className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
            >
              Editar perfil
            </Link>
          </div>
          <Acessos
            perfis={perfis.filter((p) => p.ong_id === ong.id)}
            papel="ong"
            ong={ong}
            onChange={carregar}
          />
        </section>
      ))}

      {ongs && (
        <section className={styles.card}>
          <h2>Administradores</h2>
          <p className={styles.muted}>
            Acesso total: todas as ONGs, pets, pedidos e convites.
          </p>
          <Acessos
            perfis={perfis.filter((p) => p.papel === "admin")}
            papel="admin"
            onChange={carregar}
          />
        </section>
      )}
    </>
  );
}
