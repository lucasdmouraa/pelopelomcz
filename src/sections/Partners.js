import { getOngs } from "@/services/supabase";
import styles from "./Partners.module.css";

// ONGs ativas cadastradas no painel (tabela `ong`)
export const Partners = async () => {
  const ongs = await getOngs();

  return (
    <section class="section white" id="partners">
      <div class="section-content">
        <h2>Nossos Parceiros</h2>
        <div class={styles.images}>
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
                <span class={styles.name}>{ong.nome}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
