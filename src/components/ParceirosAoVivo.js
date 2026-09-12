"use client";

import { useEffect, useState } from "react";
import { getOngs } from "@/services/supabase";
import styles from "@/sections/Partners.module.css";

// ONGs ativas (tabela `ong`), atualizadas ao abrir a página.
export const ParceirosAoVivo = ({ inicial }) => {
  const [ongs, setOngs] = useState(inicial);

  useEffect(() => {
    let ativo = true;
    getOngs()
      .then((lista) => ativo && setOngs(lista))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <section className="section white" id="partners">
      <div className="section-content">
        <h2>Nossos Parceiros</h2>
        <div className={styles.images}>
          {ongs.map((ong) => (
            <a
              key={ong.slug}
              target="_blank"
              href={ong.instagram || ong.site}
              title={ong.nome}
            >
              {ong.logo_url ? (
                <img src={ong.logo_url} alt={ong.nome} loading="lazy" />
              ) : (
                <span className={styles.name}>{ong.nome}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
