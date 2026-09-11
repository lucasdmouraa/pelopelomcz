import Script from "next/script";
import { Suez_One, Nunito } from "next/font/google";
import c from "clsx";

import "../reset.css";
import "../global.css";

const headingFont = Suez_One({
  variable: "--heading-font",
  subsets: ["latin"],
  weight: ["400"],
});
const textFont = Nunito({ variable: "--text-font", subsets: ["latin"] });

export const metadata = {
  title: "PeloPelo",
  description: "Adote animais em Maceió",
};

export default function RootLayout({ children }) {
  return (
    <html class={c(headingFont.variable, textFont.variable)} lang="pt-BR">
      <head>
        <link rel="icon" type="image/png" sizes="300x300" href="/1.webp" />
      </head>
      <body>{children}</body>
      <Script id="goatcounter-checkprod">
        {`
           const isProd = window.location.host.endsWith('.org');
           if (!isProd) {
             window.goatcounter = { no_onload: true }
           }
        `}
      </Script>

      <Script
        data-goatcounter="https://pelopelo.goatcounter.com/count"
        async
        src="//gc.zgo.at/count.js"
      />
    </html>
  );
}
