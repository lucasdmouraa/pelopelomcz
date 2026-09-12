"use client";

import { useCallback, useEffect, useState } from "react";
import c from "clsx";
import { estadoSite, publicarAgora } from "@/services/painel";
import { formatDateTime } from "@/utils";
import { usePainel } from "./PainelShell";
import styles from "./Painel.module.css";

// O site é estático: alterações entram no ar no próximo build, disparado
// automaticamente pelo banco (ver publicar_site na migration).
export const SiteStatus = () => {
  const { isAdmin } = usePainel();
  const [estado, setEstado] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const carregar = useCallback(
    () =>
      estadoSite()
        .then(setEstado)
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!estado) return null;

  const pendente =
    estado.alterado_em &&
    (!estado.publicado_em ||
      new Date(estado.alterado_em) > new Date(estado.publicado_em));

  const publicar = async () => {
    try {
      const disparou = await publicarAgora();
      setMensagem(
        disparou
          ? "Publicação iniciada: a página gerada é atualizada em cerca de 2 minutos."
          : "O deploy hook ainda não foi configurado (veja o README).",
      );
      carregar();
    } catch (e) {
      setMensagem(e.message);
    }
  };

  return (
    <div className={c(styles.alert, pendente ? styles.warn : styles.info)}>
      <span>
        {pendente
          ? "Fotos, situação e pets novos já aparecem no site na hora. A página gerada (usada nas prévias de link do WhatsApp e no Google) é atualizada sozinha alguns minutos depois da última edição."
          : estado.publicado_em
          ? `Site em dia. Última publicação em ${formatDateTime(
              estado.publicado_em,
            )}.`
          : "Site em dia."}
        {mensagem && <strong> {mensagem}</strong>}
      </span>
      {isAdmin && pendente && (
        <button className={c(styles.btn, styles.btnSmall)} onClick={publicar}>
          Publicar agora
        </button>
      )}
    </div>
  );
};
