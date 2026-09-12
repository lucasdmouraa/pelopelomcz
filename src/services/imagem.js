// Reduz fotos no navegador antes do envio (o plano gratuito do Supabase tem
// 1 GB de Storage): lado maior até 1600 px, JPEG 70%. Redesenhar no canvas
// também descarta os metadados (EXIF/GPS). Se o navegador não conseguir abrir
// a imagem (ex.: HEIC no Android), devolve o arquivo original.
const LADO_MAXIMO = 1600;

export const reduzirImagem = async (arquivo) => {
  if (!arquivo.type.startsWith("image/")) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(
      1,
      LADO_MAXIMO / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7),
    );
    if (!blob || blob.size >= arquivo.size) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
};
