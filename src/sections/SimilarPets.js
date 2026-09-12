import { SemelhantesAoVivo } from "@/components/SemelhantesAoVivo";
import { getSimilarPets } from "@/services/supabase";

// Lista do build, atualizada com os dados ao vivo ao abrir a página.
export const SimilarPets = async ({ slug }) => {
  const similarPets = await getSimilarPets(slug);
  return <SemelhantesAoVivo slug={slug} inicial={similarPets} />;
};
