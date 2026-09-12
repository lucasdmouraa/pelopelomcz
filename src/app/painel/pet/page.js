"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import c from "clsx";
import {
  Alert,
  ConfirmButton,
  FotosEditor,
  PetForm,
  usePainel,
} from "@/components/painel";
import { apagarPet, buscarPet, listarOngs, salvarPet } from "@/services/painel";
import { StatusAnimalMap } from "@/utils";
import styles from "@/components/painel/Painel.module.css";

const novoPet = (ongId) => ({
  ong_id: ongId ?? "",
  nome: "",
  especie: "cachorro",
  sexo: "femea",
  porte: "medio",
  idade: "",
  descricao: "",
  vacinado: false,
  vermifugado: false,
  castrado: false,
  especial: false,
  status: "disponivel",
});

const PetEditor = () => {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { perfil, isAdmin } = usePainel();
  const [pet, setPet] = useState(null);
  const [ongs, setOngs] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (isAdmin) listarOngs().then(setOngs);
  }, [isAdmin]);

  useEffect(() => {
    setErro(null);
    if (!id) return setPet(novoPet(perfil.ong_id));
    setPet(null);
    buscarPet(id)
      .then((dados) => {
        // pets disponíveis de outras ONGs são públicos, mas não editáveis aqui
        if (!isAdmin && dados.ong_id !== perfil.ong_id) throw new Error();
        setPet({ ...dados, descricao: dados.descricao ?? "" });
      })
      .catch(() => setErro("Pet não encontrado."));
  }, [id, perfil.ong_id, isAdmin]);

  const salvar = async (dados) => {
    setErro(null);
    setAviso(null);
    try {
      const salvo = await salvarPet({
        ...dados,
        id: pet.id,
        ong_id: isAdmin ? dados.ong_id : perfil.ong_id,
      });
      if (pet.id) {
        setPet({ ...pet, ...salvo, descricao: salvo.descricao ?? "" });
        setAviso("Alterações salvas.");
      } else {
        setAviso("Pet cadastrado! Agora adicione as fotos.");
        router.replace(`/painel/pet?id=${salvo.id}`);
      }
    } catch (e) {
      setErro(e.message);
    }
  };

  const apagar = async () => {
    try {
      await apagarPet(pet.id);
      router.replace("/painel");
    } catch (e) {
      setErro(e.message);
    }
  };

  // admin precisa da lista de ONGs antes de montar o form (select de ONG)
  const carregando = (!pet && !erro) || (isAdmin && !ongs);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <Link href="/painel" className={styles.back}>
            ← Pets
          </Link>
          <h1>{pet?.id ? pet.nome : "Novo pet"}</h1>
          {pet?.id && (
            <span className={c(styles.badge, styles[pet.status])}>
              {StatusAnimalMap[pet.status]}
            </span>
          )}
        </div>
        {pet?.status === "disponivel" && (
          <a
            href={`/adote/${pet.slug}`}
            target="_blank"
            className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
          >
            Ver no site
          </a>
        )}
      </div>

      <Alert tipo="success">{aviso}</Alert>
      <Alert tipo="error">{erro}</Alert>
      {carregando && <p className={styles.muted}>Carregando…</p>}

      {pet && !carregando && (
        <>
          <section className={styles.card}>
            <h2>Dados</h2>
            <PetForm
              key={pet.id ?? "novo"}
              pet={pet}
              ongs={isAdmin ? ongs : null}
              onSubmit={salvar}
            />
          </section>

          <section className={styles.card}>
            <h2>Fotos</h2>
            {pet.id ? (
              <FotosEditor animalId={pet.id} />
            ) : (
              <p className={styles.muted}>
                Cadastre o pet para poder adicionar fotos.
              </p>
            )}
          </section>

          {pet.id && (
            <section className={styles.card}>
              <h2>Excluir pet</h2>
              <p className={styles.muted}>
                Se ele foi adotado, prefira mudar a situação para “Adotado”: ele
                sai do site, mas o histórico e os pedidos de adoção continuam
                guardados. Excluir apaga o pet, as fotos e os pedidos.
              </p>
              <div className={styles.actions} style={{ marginTop: 12 }}>
                <ConfirmButton
                  className={c(styles.btn, styles.btnGhost, styles.btnSmall)}
                  confirmText="Clique de novo para excluir"
                  onConfirm={apagar}
                >
                  Excluir {pet.nome}
                </ConfirmButton>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
};

export default function PetPage() {
  return (
    <Suspense>
      <PetEditor />
    </Suspense>
  );
}
