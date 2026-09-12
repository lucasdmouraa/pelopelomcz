import { createClient } from "@supabase/supabase-js";
import shuffle from "just-shuffle";
import { formatPet } from "@/utils";

const databaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const db = createClient(databaseUrl, publicKey);

const PET_FIELDS = "*, ong (slug, nome), foto (public_id, ordem)";

export const registerAdoptionRequest = (data) =>
  db.from("adoption_request").insert(data);

export const registerVote = (option) => db.from("votes").insert({ option });

export const registerNewEmail = (email) =>
  db.from("newsletter").insert({ email });

// A RLS já esconde da chave pública pets não disponíveis e de ONGs inativas;
// o filtro explícito deixa a intenção clara no build.
export const getAnimals = async () => {
  const { data: pets, error } = await db
    .from("animal")
    .select(PET_FIELDS)
    .eq("status", "disponivel");
  if (error) throw error;

  return shuffle(pets.map(formatPet));
};

export const getPetBySlug = async (slug) => {
  const { data, error } = await db
    .from("animal")
    .select(PET_FIELDS)
    .eq("slug", slug)
    .single();
  if (error) throw error;

  return formatPet(data);
};

export const getSimilarPets = async (slug) => {
  const pets = await getAnimals();

  const mainPet = pets.find((pet) => pet.slug === slug);
  const remainingPets = pets.filter((pet) => pet.id !== mainPet.id);

  const calcSimilarity = (petA, petB) => {
    const fieldsToConsider = ["especie", "sexo", "porte", "idade"];
    return fieldsToConsider.filter((field) => petA[field] === petB[field])
      .length;
  };

  const points = remainingPets.map((pet) => ({
    ...pet,
    points: calcSimilarity(mainPet, pet),
  }));

  const similarPets = points.sort((a, b) => b.points - a.points).splice(0, 4);
  return shuffle(similarPets);
};

export const getOngs = async () => {
  const { data, error } = await db
    .from("ong")
    .select("slug, nome, logo_url, instagram, site")
    .order("nome");
  if (error) throw error;

  return data;
};
