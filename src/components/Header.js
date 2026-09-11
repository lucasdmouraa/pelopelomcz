"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMedia } from "react-use";

import { SimpleTextLogo } from "@/components/SimpleTextLogo";
import { BackBtn } from "@/icons";
import styles from "./Header.module.css";

const items = {
  root: [
    ["Adote", "#catalog"],
    ["Quem Somos", "#about"],
    ["Parceiros", "#partners"],
    ["Contato", "#footer"],
  ],
  adote: [
    ["Home", "/"],
    ["Mais Pets", "#catalog"],
    ["Parceiros", "#partners"],
    ["Contato", "#footer"],
  ],
};

export const Header = () => {
  const pathname = usePathname();
  const router = useRouter();

  const isMobile = useMedia("(max-width: 600px)");
  const isOnRootPage = pathname === "/";
  const itemsPath = isOnRootPage ? "root" : "adote";

  return (
    <header class={styles.container}>
      <Link href="/">
        <SimpleTextLogo />
      </Link>
      <nav className={styles.nav}>
        {items[itemsPath].map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      {!isOnRootPage && isMobile && (
        <nav class={styles.backContainer} onClick={router.back}>
          <BackBtn class={styles.icon} />
        </nav>
      )}
    </header>
  );
};
