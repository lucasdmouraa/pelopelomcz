"use client";

import { useState } from "react";
import c from "clsx";
import { applyTransformation } from "@/services/cloudinary";
import styles from "./Album.module.css";

export const Album = ({ images }) => {
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <div class={styles.container}>
      {images.map((image, index) => (
        <img
          class={c(styles.full, index === photoIndex && styles.showcase)}
          key={image}
          src={applyTransformation(images[index], "full")}
        />
      ))}

      <div class={styles.thumbs}>
        {images.map((image, index) => (
          <img
            class={c(styles.thumb, index === photoIndex && styles.active)}
            key={image}
            onClick={() => setPhotoIndex(index)}
            src={applyTransformation(image, "thumb")}
          />
        ))}
      </div>
    </div>
  );
};
