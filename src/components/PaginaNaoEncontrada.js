"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "./Header";
import { PetAoVivo } from "./PetAoVivo";
import { SemelhantesAoVivo } from "./SemelhantesAoVivo";
import styles from "./PetAoVivo.module.css";

// O Cloudflare serve esta página (404.html) para endereços sem arquivo gerado.
// Um /adote/<slug> que cai aqui é um pet publicado depois do último build:
// monta o perfil com os dados ao vivo, sem esperar o próximo deploy.
export const PaginaNaoEncontrada = () => {
  const [slug, setSlug] = useState(undefined); // undefined = verificando

  useEffect(() => {
    const achado = window.location.pathname.match(/^\/adote\/([a-z0-9-]+)\/?$/);
    setSlug(achado && achado[1] !== "_" ? achado[1] : null);
  }, []);

  return (
    <>
      <section className="section primary-to-base">
        <div className="section-content">
          <Header />
          {slug === undefined && (
            <p className={styles.carregando}>Carregando…</p>
          )}
          {slug && <PetAoVivo slug={slug} inicial={null} />}
          {slug === null && (
            <div className={styles.aviso}>
              <h1>Página não encontrada</h1>
              <p>
                O endereço pode ter mudado. Que tal conhecer os pets esperando
                por um lar?
              </p>
              <Link href="/#catalog" className="button">
                Ver pets disponíveis
              </Link>
            </div>
          )}
        </div>
      </section>
      {slug && <SemelhantesAoVivo slug={slug} inicial={[]} />}
    </>
  );
};
