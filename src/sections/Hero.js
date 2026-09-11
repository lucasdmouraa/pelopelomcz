import { Header } from "@/components";
import styles from "./Hero.module.css";

export const Hero = () => (
  <section class="section primary">
    <div class="section-content">
      <Header />

      <div class={styles.main}>
        <div class={styles.messages}>
          <h1>Vamos fazer a diferença pelos animais?</h1>
          <p>
            No coração de um abrigo, há centenas de histórias esperando para
            serem escritas. São olhares ansiosos, patinhas carentes e corações
            cheios de amor à espera de uma segunda chance.
          </p>

          <a href="#catalog" class="button">
            Adote um amigo
          </a>
        </div>
        <img src="/hero.webp" />
      </div>
    </div>
  </section>
);
