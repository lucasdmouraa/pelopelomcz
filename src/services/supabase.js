import { createClient } from "@supabase/supabase-js";
import { formatPet } from "@/utils";
import { getImages } from "./cloudinary";
import shuffle from "just-shuffle";

const databaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const db = createClient(databaseUrl, publicKey);

export const registerAdoptionRequest = (data) =>
  db.from("adoption_request").insert(data);

export const registerVote = (option) => db.from("votes").insert({ option });

export const registerNewEmail = (email) =>
  db.from("newsletter").insert({ email });

export const getAnimals = async () => {
  const { data: pets } = await db.from("animal").select();

  const images = await getImages();
  const findImage = (pet) => images.find((i) => i.id == pet.id)?.url;

  const shinningPets = pets.map((pet) => ({
    ...formatPet(pet),
    image: findImage(pet),
  }));
  return shuffle(shinningPets);
};

export const getPetByName = async (name) => {
  const { data } = await db.from("animal").select().eq("nome", name);
  const pet = data[0];
  return formatPet(pet);
};

export const getSimilarPets = async (petName) => {
  const pets = await getAnimals();

  const mainPet = pets.find((pet) => pet.nome === petName);
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
