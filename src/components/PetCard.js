import Link from "next/link";
import { applyTransformation } from "@/services/cloudinary";

import styles from "./PetCard.module.css";

export const PetCard = ({ pet }) => (
  <div class={styles.container}>
    <img src={applyTransformation(pet.image, "mini")} />
    <div class={styles.details}>
      <div>
        <h3>{pet.nome}</h3>
        <p>{pet.sexo}</p>
      </div>
      <hr></hr>
      <p>
        {pet.idade}, {pet.porte}
      </p>
    </div>
    <Link href={`/adote/${pet.nome.toLowerCase()}`}>
      <button>Adotar</button>
    </Link>
  </div>
);
