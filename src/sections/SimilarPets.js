import { PetCard } from "@/components";
import { getSimilarPets } from "@/services/supabase";
import styles from "./SimilarPets.module.css";

export const SimilarPets = async ({ petName }) => {
  const similarPets = await getSimilarPets(petName);

  return (
    <section class="section base" id="catalog">
      <div class="section-content">
        <h2>Animais Semelhantes</h2>

        <div class={styles.list}>
          {similarPets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>
      </div>
    </section>
  );
};
