import c from "clsx";
import styles from "./Footer.module.css";

export const Footer = () => (
  <>
    <section class="section secondary" id="footer">
      <div class={c("section-content", styles.content)}>
        <div class={styles.logoContainer}>
          <img src="/1.webp" loading="lazy" />
          <img src="/tipografia.webp" loading="lazy" />
        </div>
        <div class={styles.verticalLine}></div>
        <div class={styles.social}>
          <div class={styles.icons}>
            {/* TODO: confirmar perfil do Instagram de Maceió */}
            <a target="_blank" href="https://www.instagram.com/pelopelomcz">
              <div class={styles.iconContainer}>
                <img src="/instagram.png" loading="lazy" />
              </div>
            </a>
            <div class={styles.iconContainer}>
              <img src="/zap.png" loading="lazy" />
            </div>
            <a target="_blank" href="mailto:contato@pelopelo.org">
              <div class={styles.iconContainer}>
                <img src="/mail.png" loading="lazy" />
              </div>
            </a>
          </div>
          <span>contato@pelopelo.org</span>
        </div>
      </div>
    </section>
    <section class={c("colored-section", styles.end)}>
      <p>PeloPelo - Fazendo a diferença na causa animal - 2023</p>
    </section>
  </>
);
