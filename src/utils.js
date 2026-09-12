export const scrollTo = (elem) => {
  const element = document.getElementById(elem);
  const y = element.getBoundingClientRect().top + window.scrollY - 30;
  window.scroll({ top: y, behavior: "smooth" });
};

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("pt-BR");

// "YYYY-MM-DD" no fuso do navegador. toISOString() daria a data em UTC: depois
// das 21h em Maceió já seria o dia seguinte.
export const dataLocal = (data = new Date()) =>
  new Date(data.getTime() - data.getTimezoneOffset() * 6e4)
    .toISOString()
    .slice(0, 10);

export const formatDateTime = (dateStr) =>
  new Date(dateStr).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

export const slugify = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Valores aceitos pelo banco → rótulos exibidos (usados também no painel).
export const EspecieMap = { cachorro: "Canina", gato: "Felina" };
export const SexoMap = { macho: "Macho", femea: "Fêmea" };
export const SizeMap = {
  pequeno: "Pequeno Porte",
  medio: "Médio Porte",
  grande: "Grande Porte",
  gigante: "Gigantão",
};
// A ordem define o select de situação no painel. Só "disponivel" vai ao site.
export const StatusAnimalMap = {
  em_avaliacao: "Recém-chegado",
  disponivel: "Disponível",
  em_processo: "Em processo de adoção",
  adotado: "Adotado",
  morador: "Morador do abrigo",
  falecido: "Falecido",
};
export const FuncaoMap = {
  coordenacao: "Coordenação",
  voluntario: "Voluntário(a)",
};
export const ViaMap = {
  oral: "Oral",
  injetavel: "Injetável",
  topico: "Na pele",
  colirio: "Nos olhos",
  ouvido: "No ouvido",
  outro: "Outra via",
};
export const TipoEventoMap = {
  vacina: "Vacina",
  vermifugo: "Vermífugo",
  antipulgas: "Antipulgas/carrapatos",
  consulta: "Consulta",
  exame: "Exame",
  cirurgia: "Cirurgia",
  castracao: "Castração",
  peso: "Peso",
  outro: "Outro",
};
export const StatusPedidoMap = {
  novo: "Novo",
  em_contato: "Em contato",
  concluido: "Adoção concluída",
  recusado: "Não seguiu",
};

export const formatPet = ({ foto = [], ong, ...pet }) => {
  const images = [...foto]
    .sort((a, b) => a.ordem - b.ordem)
    .map((f) => f.public_id);

  return {
    ...pet,
    especie: EspecieMap[pet.especie],
    ong: ong?.nome,
    porte: SizeMap[pet.porte],
    sexo: SexoMap[pet.sexo],
    images,
    image: images[0],
  };
};
