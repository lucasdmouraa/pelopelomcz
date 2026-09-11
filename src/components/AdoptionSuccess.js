import styles from "./AdoptionSuccess.module.css";

export const AdoptionSuccess = () => (
  <div class={styles.container}>
    <img src="/petsinbox.png" />
    <h1>Parabéns!</h1>
    <p class={styles.subheadline}>Interesse enviado com sucesso</p>
    <p>
      Seus dados foram enviados para a ONG responsável. <br />
      Você será contactado pelo Whatsapp assim que possível pelo atual
      responsável pelo Pet.
    </p>
  </div>
);
