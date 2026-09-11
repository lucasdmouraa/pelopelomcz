export const scrollTo = (elem) => {
  const element = document.getElementById(elem);
  const y = element.getBoundingClientRect().top + window.scrollY - 30;
  window.scroll({ top: y, behavior: "smooth" });
};

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("pt-BR");

const formatEspecie = (especie) => (especie === "gato" ? "Felina" : "Canina");
const formatOng = (ong) => {
  const OngsMap = {
    "pata-amada": "Grupo Pata Amada",
    "sos-pet-pinheiro": "SOS Pet Pinheiro",
    "projeto-acolher": "Projeto Acolher Maceió",
  };

  return OngsMap[ong];
};
const formatPorte = (size) => {
  const SizeMap = {
    pequeno: "Pequeno Porte",
    medio: "Médio Porte",
    grande: "Grande Porte",
    gigante: "Gigantão",
  };

  return SizeMap[size];
};
const formatSexo = (sex) => (sex === "femea" ? "Fêmea" : "Macho");

export const formatPet = (pet) => ({
  ...pet,
  especie: formatEspecie(pet.especie),
  ong: formatOng(pet.ong),
  porte: formatPorte(pet.porte),
  sexo: formatSexo(pet.sexo),
});
