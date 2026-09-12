"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buscarPetPublico } from "@/services/supabase";
import { Album } from "./Album";
import { PetInfo } from "./PetInfo";
import profile from "@/sections/PetProfile.module.css";
import styles from "./PetAoVivo.module.css";

// Perfil do pet com os dados atuais do banco. `inicial` é a versão do build
// (null quando a página ainda não foi gerada: pet cadastrado depois do deploy).
export const PetAoVivo = ({ slug, inicial }) => {
  const [pet, setPet] = useState(inicial);
  const [estado, setEstado] = useState(inicial ? "pronto" : "carregando");

  useEffect(() => {
    let ativo = true;
    buscarPetPublico(slug)
      .then((vivo) => {
        if (!ativo) return;
        if (vivo) {
          setPet(vivo);
          setEstado("pronto");
          if (!inicial) document.title = `Adote ${vivo.nome} · PeloPelo`;
        } else {
          setEstado("indisponivel");
        }
      })
      // sem conexão com o banco: fica a versão do build, se houver
      .catch(() => ativo && !inicial && setEstado("indisponivel"));
    return () => {
      ativo = false;
    };
  }, [slug, inicial]);

  if (estado === "carregando") {
    return <p className={styles.carregando}>Carregando…</p>;
  }

  if (estado === "indisponivel") {
    return (
      <div className={styles.aviso}>
        <h1>
          {pet ? `${pet.nome} não está mais disponível` : "Pet não encontrado"}
        </h1>
        <p>
          {pet
            ? "Talvez já tenha encontrado um lar! Veja outros pets esperando por uma família."
            : "Este pet não está disponível para adoção no momento."}
        </p>
        <Link href="/#catalog" className="button">
          Ver pets disponíveis
        </Link>
      </div>
    );
  }

  return (
    <div className={profile.main}>
      <Album key={pet.images.join()} images={pet.images} />
      <PetInfo pet={pet} />
    </div>
  );
};
