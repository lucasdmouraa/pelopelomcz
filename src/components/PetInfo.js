import c from "clsx";
import { formatDate } from "@/utils";
import { Castrado, Especial, Vacina, Vermifugo } from "@/icons";
import { Adopt } from "./Adopt";
import styles from "./PetInfo.module.css";

const IconsMap = {
  castrado: Castrado,
  especial: Especial,
  vacinado: Vacina,
  vermifugado: Vermifugo,
};

const ProfileInfoCard = ({ label, value }) => {
  const Icon = IconsMap[label.replace("*", "")];

  return (
    <div class={styles.infoCard}>
      <Icon class={styles.icon} active={value} />
      <h3 class={c(!value && styles.inactive)}>{label}</h3>
      <div class={c(!value && styles.inactive)}></div>
    </div>
  );
};

export const PetInfo = ({ pet }) => (
  <div class={styles.container}>
    <div class={styles.headerContainer}>
      <div class={styles.header}>
        <h1>{pet.nome}</h1>
        <p>Publicado em {formatDate(pet.created_at)}</p>
      </div>
    </div>

    <div class={styles.infoContainer}>
      <div class={styles.info}>
        <span>Espécie</span>
        <span>{pet.especie}</span>
      </div>
      <div class={styles.info}>
        <span>Sexo</span>
        <span>{pet.sexo}</span>
      </div>
      <div class={styles.info}>
        <span>Idade</span>
        <span>{pet.idade}</span>
      </div>
      <div class={styles.info}>
        <span>Tamanho</span>
        <span>{pet.porte}</span>
      </div>
      <div class={styles.info}>
        <span>ONG</span>
        <span>{pet.ong}</span>
      </div>
    </div>
    <div class={styles.icons}>
      <ProfileInfoCard label="vacinado*" value={pet.vacinado} />
      <ProfileInfoCard label="vermifugado" value={pet.vermifugado} />
      <ProfileInfoCard label="castrado" value={pet.castrado} />
      <ProfileInfoCard label="especial" value={pet.especial} />
    </div>
    <p class={styles.vacinaSubtitle}>*Vacina Antirrábica</p>

    <div class={styles.footer}>
      <Adopt pet={pet} />
    </div>
  </div>
);
