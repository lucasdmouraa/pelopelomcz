import c from "clsx";
import styles from "./About.module.css";

export const About = () => (
  <section class={c("section", "base", styles.container)} id="about">
    <div class="section-content">
      <h2>Quem Somos</h2>
      <p>
        Somos três amigos com grandes sonhos. Três desenvolvedores que acreditam
        na tecnologia como ferramenta de transformação e revolução social. E
        dentre vários sonhos e projetos, existia um desejo muito grande de
        ajudar os animais de rua, decidimos então tirar esse lindo projeto do
        papel.
      </p>
      <h2>Nossa Missão</h2>
      <p>
        A missão do PeloPelo é criar um impacto significativo na vida dos
        animais por meio da tecnologia e inovação. Acreditamos que todos os
        seres vivos merecem cuidado, compaixão e uma chance de viver uma vida
        feliz e saudável. Trabalhamos para apoiar as organizações de proteção
        animal e contribuir para um mundo onde todos os animais sejam tratados
        com respeito e dignidade.
      </p>
      <h2>Valores</h2>
      <div class={styles.values}>
        <div class="value">
          <h3>Compaixão</h3>
          <p>
            A compaixão é o coração do nosso projeto, queremos dar a devida
            atenção aos animais indefesos.
          </p>
        </div>
        <div class="value">
          <h3>Inovação</h3>
          <p>
            Abraçamos a inovação como uma ferramenta poderosa para criar
            soluções criativas e eficazes para os desafios enfrentados pelos
            animais, ONGs e casas de abrigo.
          </p>
        </div>
        <div class="value">
          <h3>Parceria</h3>
          <p>
            Reconhecemos que a mudança real só é possível quando trabalhamos
            juntos. Buscamos estabelecer parcerias sólidas com organizações de
            proteção animal, voluntários, doadores e defensores.
          </p>
        </div>
        <div class="value">
          <h3>Transparência</h3>
          <p>
            Acreditamos na transparência total em todas as nossas atividades.
            Garantimos que nossos esforços sejam sempre guiados pelos melhores
            interesses dos animais.
          </p>
        </div>
      </div>
    </div>
  </section>
);
