"use client";

import { useCallback, useEffect, useState } from "react";
import { Acessos, Alert, usePainel } from "@/components/painel";
import { listarEquipe } from "@/services/painel";
import styles from "@/components/painel/Painel.module.css";

// A coordenação monta a própria equipe; o admin usa "ONGs e acessos".
export default function EquipePage() {
  const { perfil, isAdmin, isCoordenacao } = usePainel();
  const [perfis, setPerfis] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      listarEquipe(perfil.ong_id)
        .then(setPerfis)
        .catch((e) => setErro(e.message)),
    [perfil.ong_id],
  );

  useEffect(() => {
    if (isCoordenacao && !isAdmin) carregar();
  }, [isCoordenacao, isAdmin, carregar]);

  if (isAdmin) {
    return (
      <Alert tipo="info">
        O admin gerencia as equipes em “ONGs e acessos”.
      </Alert>
    );
  }
  if (!isCoordenacao) {
    return <Alert tipo="error">Página da coordenação da ONG.</Alert>;
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Equipe</h1>
      </div>
      <p className={styles.muted}>
        <strong>Coordenação:</strong> tudo da ONG, inclusive pedidos de adoção,
        equipe e publicação dos pets no site. <strong>Voluntário(a):</strong>{" "}
        cadastra e cuida dos pets (dados, ficha, fotos), mas não publica, não vê
        pedidos de adoção e não altera o perfil da ONG.
      </p>

      <Alert tipo="error">{erro}</Alert>
      {!perfis && !erro && <p className={styles.muted}>Carregando…</p>}
      {perfis && (
        <section className={styles.card} style={{ marginTop: 16 }}>
          <Acessos
            perfis={perfis}
            papel="ong"
            ong={perfil.ong}
            onChange={carregar}
          />
        </section>
      )}
    </>
  );
}
