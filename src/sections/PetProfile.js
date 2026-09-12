import { Album, PetInfo, Header } from "@/components";

import styles from "./PetProfile.module.css";

export const PetProfile = ({ pet }) => (
  <section class="section primary-to-base">
    <div class="section-content">
      <Header />
      <div class={styles.main}>
        <Album images={pet.images} />
        <PetInfo pet={pet} />
      </div>
    </div>
  </section>
);
