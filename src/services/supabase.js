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

// Usadas no build (páginas estáticas) e no navegador (dados ao vivo). A RLS já
// esconde da chave pública pets não disponíveis e de ONGs inativas; o filtro
// explícito deixa a intenção clara.
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

// Ao vivo: null quando o pet não está (mais) disponível para adoção.
export const buscarPetPublico = async (slug) => {
  const { data, error } = await db
    .from("animal")
    .select(PET_FIELDS)
    .eq("slug", slug)
    .eq("status", "disponivel")
    .maybeSingle();
  if (error) throw error;

  return data ? formatPet(data) : null;
};

// Até 4 pets com mais características em comum. Ordem determinística (sem
// sorteio) para o build e a versão ao vivo mostrarem a mesma lista.
export const escolherSemelhantes = (principal, pets) => {
  const campos = ["especie", "sexo", "porte", "idade"];
  const pontos = (pet) =>
    campos.filter((campo) => pet[campo] === principal[campo]).length;

  return pets
    .filter((pet) => pet.id !== principal.id)
    .map((pet) => ({ pet, pontos: pontos(pet) }))
    .sort((a, b) => b.pontos - a.pontos || a.pet.id - b.pet.id)
    .slice(0, 4)
    .map(({ pet }) => pet);
};

export const getSimilarPets = async (slug) => {
  const pets = await getAnimals();
  const principal = pets.find((pet) => pet.slug === slug);
  return principal ? escolherSemelhantes(principal, pets) : [];
};

export const getOngs = async () => {
  const { data, error } = await db
    .from("ong")
    .select("slug, nome, logo_url, instagram, site")
    .order("nome");
  if (error) throw error;

  return data;
};
