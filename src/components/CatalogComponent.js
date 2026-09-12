"use client";

import { range, splitEvery } from "ramda";
import { useEffect, useState } from "react";
import c from "clsx";
import { scrollTo } from "@/utils";
import { getAnimals } from "@/services/supabase";
import { PetCard } from "./PetCard";

import styles from "./CatalogComponent.module.css";

const PAGE_SIZE = 8;

// Mostra na hora a lista do build e, ao abrir, troca pelos dados atuais do
// banco: pet novo, foto trocada ou pet que saiu aparecem sem esperar deploy.
export const CatalogComponent = ({ pets }) => {
  const [lista, setLista] = useState(pets);
  const [activePageIndex, setActivePageIndex] = useState(1);

  useEffect(() => {
    let ativo = true;
    getAnimals()
      .then((vivos) => {
        if (!ativo) return;
        // mantém a ordem que a pessoa já está vendo; novos entram primeiro
        const posicao = new Map(pets.map((pet, i) => [pet.id, i]));
        const lugar = (pet) => posicao.get(pet.id) ?? -1;
        setLista([...vivos].sort((a, b) => lugar(a) - lugar(b)));
      })
      .catch(() => {}); // sem conexão com o banco: fica a versão do build
    return () => {
      ativo = false;
    };
  }, [pets]);

  if (!lista.length) {
    return <p>Nenhum pet disponível no momento. Volte em breve!</p>;
  }

  const pages = Math.ceil(lista.length / PAGE_SIZE);
  const groupedPets = splitEvery(PAGE_SIZE, lista);
  const paginaAtual = Math.min(activePageIndex, pages);
  const activePage = groupedPets[paginaAtual - 1];

  const handlePageChange = (newIndex) => {
    setActivePageIndex(newIndex);
    scrollTo("catalog");
  };

  return (
    <>
      <div class={styles.list}>
        {activePage.map((pet) => (
          <PetCard key={pet.id} pet={pet} />
        ))}
      </div>
      <div class={styles.pagination}>
        {range(1, pages + 1).map((page) => (
          <span
            key={page}
            className={c(paginaAtual === page && styles.activePage)}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </span>
        ))}
      </div>
    </>
  );
};
