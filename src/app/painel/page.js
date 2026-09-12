"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import c from "clsx";
import { Alert, SiteStatus, usePainel } from "@/components/painel";
import { listarOngs, listarPets } from "@/services/painel";
import { imageUrl } from "@/services/cloudinary";
import { SizeMap, StatusAnimalMap } from "@/utils";
import styles from "@/components/painel/Painel.module.css";

// quem está sob os cuidados da ONG agora
const NO_ABRIGO = ["em_avaliacao", "disponivel", "em_processo", "morador"];

const FILTROS = [
  ["abrigo", "No abrigo"],
  ["em_avaliacao", "Recém-chegados"],
  ["disponivel", "Disponíveis"],
  ["em_processo", "Em processo"],
  ["morador", "Moradores"],
  ["adotado", "Adotados"],
  ["falecido", "Falecidos"],
  ["todos", "Todos"],
];

const noFiltro = (pet, filtro) =>
  filtro === "todos" ||
  (filtro === "abrigo"
    ? NO_ABRIGO.includes(pet.status)
    : pet.status === filtro);

const capa = (pet) =>
  [...pet.foto].sort((a, b) => a.ordem - b.ordem)[0]?.public_id;

export default function PetsPage() {
  const { perfil, isAdmin } = usePainel();
  const [pets, setPets] = useState(null);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState("abrigo");
  const [ongs, setOngs] = useState([]);
  const [ongId, setOngId] = useState("");

  useEffect(() => {
    if (isAdmin) listarOngs().then(setOngs);
  }, [isAdmin]);

  useEffect(() => {
    setPets(null);
    listarPets(isAdmin ? ongId || null : perfil.ong_id)
      .then(setPets)
      .catch((e) => setErro(e.message));
  }, [isAdmin, ongId, perfil.ong_id]);

  const visiveis = pets?.filter((pet) => noFiltro(pet, filtro)) ?? [];

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{isAdmin ? "Pets" : "Pets da ONG"}</h1>
        <Link href="/painel/pet" className={c(styles.btn, styles.btnPrimary)}>
          + Cadastrar pet
        </Link>
      </div>

      <SiteStatus />

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
                {pets?.filter((pet) => noFiltro(pet, valor)).length ?? ""}
              </span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <select
            className={styles.select}
            value={ongId}
            onChange={(e) => setOngId(e.target.value)}
          >
            <option value="">Todas as ONGs</option>
            {ongs.map((ong) => (
              <option key={ong.id} value={ong.id}>
                {ong.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <Alert tipo="error">{erro}</Alert>
      {!pets && !erro && <p className={styles.muted}>Carregando…</p>}
      {pets && visiveis.length === 0 && (
        <div className={styles.empty}>
          {pets.length === 0
            ? "Nenhum pet cadastrado ainda. Que tal cadastrar o primeiro?"
            : "Nenhum pet nesta situação."}
        </div>
      )}

      <div className={styles.grid}>
        {visiveis.map((pet) => (
          <Link
            key={pet.id}
            href={`/painel/pet?id=${pet.id}`}
            className={styles.petCard}
          >
            <img src={imageUrl(capa(pet), "mini")} alt="" />
            <div className={styles.petCardBody}>
              <strong>{pet.nome}</strong>
              <span className={c(styles.badge, styles[pet.status])}>
                {StatusAnimalMap[pet.status]}
              </span>
              <span className={styles.muted}>
                {pet.especie === "gato" ? "Gato" : "Cachorro"} ·{" "}
                {SizeMap[pet.porte]} · {pet.idade}
              </span>
              {isAdmin && <span className={styles.muted}>{pet.ong.nome}</span>}
              {pet.foto.length === 0 && (
                <span className={styles.muted}>⚠ Sem fotos</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
