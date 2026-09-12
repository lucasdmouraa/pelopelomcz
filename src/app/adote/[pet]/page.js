import { notFound } from "next/navigation";
import { getAnimals, getPetBySlug } from "@/services/supabase";
import { imageUrl } from "@/services/cloudinary";
import { PetProfile, SimilarPets, Partners, Footer } from "@/sections";

// O Next 13 recusa exportar uma rota dinâmica sem nenhum parâmetro. Sem pets
// publicados, gera só este placeholder, que responde 404.
const SEM_PETS = "_";

// O slug ("mel-12") é gerado pelo banco e não muda, mesmo se o pet for renomeado.
export const generateStaticParams = async () => {
  const pets = await getAnimals();
  if (!pets.length) return [{ pet: SEM_PETS }];
  return pets.map((pet) => ({ pet: pet.slug }));
};

// Prévia do link ao compartilhar no WhatsApp/Instagram
export const generateMetadata = async ({ params: { pet: slug } }) => {
  if (slug === SEM_PETS) return {};

  const pet = await getPetBySlug(slug);
  return {
    title: `Adote ${pet.nome} · PeloPelo`,
    description: `${pet.nome} está esperando por um lar em Maceió. Conheça no PeloPelo!`,
    openGraph: pet.image
      ? { images: [imageUrl(pet.image, "mini")] }
      : undefined,
  };
};

const AdoptPage = async ({ params: { pet: slug } }) => {
  if (slug === SEM_PETS) notFound();

  const pet = await getPetBySlug(slug);

  return (
    <main>
      <PetProfile pet={pet} />
      <SimilarPets slug={slug} />
      <Partners />
      <Footer />
    </main>
  );
};

export default AdoptPage;
