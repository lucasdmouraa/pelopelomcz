import { getAnimals, getPetByName } from "@/services/supabase";
import { PetProfile, SimilarPets, Partners, Footer } from "@/sections";

// needed because the pet name from url is lowercased
// and all from database is capitalized
const capitalize = (str) => str[0].toUpperCase() + str.substring(1);

export const generateStaticParams = async () => {
  const pets = await getAnimals();
  return pets.map((pet) => ({ pet: pet.nome.toLowerCase() }));
};

const AdoptPage = async ({ params: { pet: petName } }) => {
  const capitalizedName = capitalize(petName);
  const _pet = await getPetByName(capitalizedName);

  return (
    <main>
      <PetProfile pet={_pet} />
      <SimilarPets petName={capitalizedName} />
      <Partners />
      <Footer />
    </main>
  );
};

export default AdoptPage;
