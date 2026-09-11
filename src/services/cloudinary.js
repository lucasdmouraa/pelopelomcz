export const getImages = async () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const rawResult = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?max_results=250`,
    { headers: { Authorization: `Basic ${process.env.CLOUDINARY_AUTH}` } },
  );

  const { resources } = await rawResult.json();
  return resources.map(({ secure_url, folder }) => ({
    url: secure_url,
    id: folder,
  }));
};

export const getImagesFromPet = async (petId) => {
  const images = await getImages();
  return images.filter((i) => i.id == petId).map((image) => image.url);
};

export const applyTransformation = (url, transformation) => {
  const TransformationsMap = {
    thumb: "t_media_lib_thumb",
    mini: "t_mini",
    full: "t_full",
  };

  const chunks = url.split("/");
  const index = chunks.findIndex((chunk) => chunk === "upload");
  chunks.splice(index + 1, 0, TransformationsMap[transformation]);
  return chunks.join("/");
};
