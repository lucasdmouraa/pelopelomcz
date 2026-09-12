const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

// Transformações aplicadas direto na URL: não precisam ser cadastradas no
// Cloudinary. Tamanhos ~2x o exibido para telas de alta densidade.
const TransformationsMap = {
  thumb: "c_fill,g_auto,w_120,h_120,f_auto,q_auto",
  mini: "c_fill,g_auto,w_480,h_480,f_auto,q_auto",
  full: "c_limit,w_1400,h_1400,f_auto,q_auto",
};

export const PLACEHOLDER_IMAGE = "/1.webp";

// Recebe o public_id guardado na tabela `foto` (ex.: "pets/12/abc-123").
export const imageUrl = (publicId, transformation) =>
  publicId
    ? `https://res.cloudinary.com/${cloudName}/image/upload/${TransformationsMap[transformation]}/${publicId}`
    : PLACEHOLDER_IMAGE;
