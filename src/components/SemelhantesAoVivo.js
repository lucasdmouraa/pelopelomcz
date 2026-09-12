"use client";

import { useEffect, useState } from "react";
import { escolherSemelhantes, getAnimals } from "@/services/supabase";
import { PetCard } from "./PetCard";
import styles from "@/sections/SimilarPets.module.css";

// Pets semelhantes com os dados atuais. Se o pet principal saiu da vitrine,
// mostra outros pets disponíveis.
export const SemelhantesAoVivo = ({ slug, inicial }) => {
  const [lista, setLista] = useState(inicial);
  const [titulo, setTitulo] = useState("Animais Semelhantes");

  useEffect(() => {
    let ativo = true;
    getAnimals()
      .then((pets) => {
        if (!ativo) return;
        const principal = pets.find((pet) => pet.slug === slug);
        setLista(
          principal ? escolherSemelhantes(principal, pets) : pets.slice(0, 4),
        );
        setTitulo(
          principal ? "Animais Semelhantes" : "Outros pets para adoção",
        );
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [slug]);

  if (!lista.length) return null;

  return (
    <section className="section base" id="catalog">
      <div className="section-content">
        <h2>{titulo}</h2>
        <div className={styles.list}>
          {lista.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>
      </div>
    </section>
  );
};
