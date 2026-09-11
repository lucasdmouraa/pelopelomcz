import styles from "./Partners.module.css";

const ongs = [
  { image: "pata-amada", link: "https://www.instagram.com/grupopataamada/" },
  {
    image: "sos-pet-pinheiro",
    link: "https://www.instagram.com/sospetpinheiro/",
  },
  {
    image: "projeto-acolher",
    link: "https://www.instagram.com/projetoacolher/",
  },
];

export const Partners = () => (
  <section class="section white" id="partners">
    <div class="section-content">
      <h2>Nossos Parceiros</h2>
      <div class={styles.images}>
        {ongs.map((ong) => (
          <a key={ong.image} target="_blank" href={ong.link}>
            <img src={`/${ong.image}.png`} loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  </section>
);
