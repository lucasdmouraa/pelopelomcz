import { PaginaNaoEncontrada } from "@/components/PaginaNaoEncontrada";
import { Partners, Footer } from "@/sections";

// Vira o 404.html do export: o Cloudflare o serve para qualquer endereço sem
// arquivo — inclusive /adote/<slug> de pets publicados depois do último build.
export default function NotFound() {
  return (
    <main>
      <PaginaNaoEncontrada />
      <Partners />
      <Footer />
    </main>
  );
}
