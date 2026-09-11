"use client";

import { range, splitEvery } from "ramda";
import { useState } from "react";
import c from "clsx";
import { scrollTo } from "@/utils";
import { PetCard } from "./PetCard";

import styles from "./CatalogComponent.module.css";

const PAGE_SIZE = 8;

export const CatalogComponent = ({ pets }) => {
  const [activePageIndex, setActivePageIndex] = useState(1);

  const pages = Math.ceil(pets.length / PAGE_SIZE);
  const groupedPets = splitEvery(PAGE_SIZE, pets);
  const activePage = groupedPets[activePageIndex - 1];

  const handlePageChange = (newIndex) => {
    setActivePageIndex(newIndex);
    scrollTo("catalog");
  };

  return (
    <>
      <div class={styles.list}>
        {activePage.map((pet) => (
          <PetCard key={pet.id} pet={pet} />
        ))}
      </div>
      <div class={styles.pagination}>
        {range(1, pages + 1).map((page) => (
          <span
            key={page}
            className={c(activePageIndex === page && styles.activePage)}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </span>
        ))}
      </div>
    </>
  );
};
