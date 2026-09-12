"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apagarFoto,
  enviarFoto,
  listarFotos,
  reordenarFotos,
} from "@/services/painel";
import { imageUrl } from "@/services/cloudinary";
import { Alert, ConfirmButton } from "./ui";
import styles from "./Painel.module.css";

export const FotosEditor = ({ animalId }) => {
  const [fotos, setFotos] = useState([]);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    () =>
      listarFotos(animalId)
        .then(setFotos)
        .catch((e) => setErro(e.message)),
    [animalId],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = async (event) => {
    const arquivos = [...event.target.files];
    event.target.value = "";
    setErro(null);

    const proximaOrdem = fotos.length
      ? Math.max(...fotos.map((f) => f.ordem)) + 1
      : 0;
    const falhas = [];
    for (const [i, arquivo] of arquivos.entries()) {
      setProgresso(`Enviando ${i + 1} de ${arquivos.length}…`);
      try {
        await enviarFoto(animalId, arquivo, proximaOrdem + i);
      } catch (e) {
        falhas.push(`${arquivo.name}: ${e.message}`);
      }
    }
    setProgresso(null);
    if (falhas.length) setErro(falhas.join(" · "));
    carregar();
  };

  const mover = async (index, delta) => {
    const novaOrdem = [...fotos];
    [novaOrdem[index], novaOrdem[index + delta]] = [
      novaOrdem[index + delta],
      novaOrdem[index],
    ];
    setFotos(novaOrdem);
    try {
      await reordenarFotos(novaOrdem);
    } catch (e) {
      setErro(e.message);
      carregar();
    }
  };

  const apagar = async (foto) => {
    setFotos((atuais) => atuais.filter((f) => f.id !== foto.id));
    try {
      await apagarFoto(foto.id);
    } catch (e) {
      setErro(e.message);
      carregar();
    }
  };

  return (
    <>
      <p className={styles.muted}>
        A primeira foto é a capa no catálogo. Use as setas para mudar a ordem.
      </p>
      <Alert tipo="error">{erro}</Alert>
      <div className={styles.fotos}>
        {fotos.map((foto, index) => (
          <div key={foto.id} className={styles.foto}>
            <img src={imageUrl(foto.public_id, "mini")} alt="" />
            {index === 0 && <span className={styles.fotoCapa}>Capa</span>}
            <div className={styles.fotoActions}>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={index === 0}
                onClick={() => mover(index, -1)}
                aria-label="Mover para a esquerda"
              >
                ◀
              </button>
              <ConfirmButton
                className={styles.iconBtn}
                confirmText="Apagar?"
                onConfirm={() => apagar(foto)}
                aria-label="Apagar foto"
              >
                ✕
              </ConfirmButton>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={index === fotos.length - 1}
                onClick={() => mover(index, 1)}
                aria-label="Mover para a direita"
              >
                ▶
              </button>
            </div>
          </div>
        ))}
        <label className={styles.upload}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={enviar}
            disabled={!!progresso}
          />
          {progresso ?? (
            <>
              <strong>+</strong>
              Adicionar fotos
            </>
          )}
        </label>
      </div>
    </>
  );
};
