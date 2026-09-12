// Service worker do painel (app instalável no celular).
//
// Só guarda os arquivos estáticos do Next (/_next/static, que têm hash no
// nome e nunca mudam). Páginas vão sempre à rede, para não servir versão velha
// depois de um deploy. Supabase, Cloudinary e qualquer outro domínio passam
// direto — dados do painel nunca ficam em cache.
const CACHE = "painel-estatico-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const salvo = await cache.match(request);
      if (salvo) return salvo;
      const resposta = await fetch(request);
      if (resposta.ok) cache.put(request, resposta.clone());
      return resposta;
    }),
  );
});
