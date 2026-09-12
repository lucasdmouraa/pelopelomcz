import { Header } from "@/components";
import { PetAoVivo } from "@/components/PetAoVivo";

// Perfil gerado no build e atualizado com os dados ao vivo ao abrir.
export const PetProfile = ({ pet }) => (
  <section class="section primary-to-base">
    <div class="section-content">
      <Header />
      <PetAoVivo slug={pet.slug} inicial={pet} />
    </div>
  </section>
);
