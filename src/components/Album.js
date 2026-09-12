"use client";

import { useState } from "react";
import c from "clsx";
import { imageUrl } from "@/services/cloudinary";
import styles from "./Album.module.css";

export const Album = ({ images }) => {
  const [photoIndex, setPhotoIndex] = useState(0);

  // pet sem fotos mostra o placeholder
  const photos = images.length ? images : [null];

  return (
    <div class={styles.container}>
      {photos.map((image, index) => (
        <img
          class={c(styles.full, index === photoIndex && styles.showcase)}
          key={image ?? "placeholder"}
          src={imageUrl(image, "full")}
        />
      ))}

      <div class={styles.thumbs}>
        {photos.map((image, index) => (
          <img
            class={c(styles.thumb, index === photoIndex && styles.active)}
            key={image ?? "placeholder"}
            onClick={() => setPhotoIndex(index)}
            src={imageUrl(image, "thumb")}
          />
        ))}
      </div>
    </div>
  );
};
