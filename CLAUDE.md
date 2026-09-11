# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # static export to /out
npm run lint     # ESLint via Next.js
```

No test suite exists. Formatting is enforced automatically via Husky pre-commit hook (Prettier on `*.{js,css,html}`).

## Architecture

**PeloPelo Maceió** is a pet adoption landing page for Maceió, Alagoas, Brazil. It is a clone of the original Campina Grande app (`../pelopelo`) with its own partner ONGs, contacts and backend. It is a Next.js app with `output: "export"` (fully static), so there is no server runtime — data is fetched at build time via `generateStaticParams` and async Server Components.

### Pages

- `/` — home page: Hero → Catalog → About → Partners → Footer
- `/adote/[pet]` — individual pet profile page: PetProfile → SimilarPets → Partners → Footer

### Data layer (`src/services/`)

- **`supabase.js`** — Supabase client configured from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key is public by design; RLS enforces access). Tables: `animal`, `adoption_request`, `votes`, `newsletter`. Pet data is fetched and formatted via `formatPet` from `utils.js`.
- **`cloudinary.js`** — fetches pet images from Cloudinary using `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_AUTH` env vars. Images are organized by folder named with the pet's `id`. Exposes `applyTransformation(url, 'thumb'|'mini'|'full')` which splices a named transformation into the Cloudinary URL.

`getAnimals()` joins both services: fetches pets from Supabase + images from Cloudinary, merges them by `pet.id === image.id`, then shuffles.

### Component model

- **Server Components** (`src/sections/`): fetch data directly. `Catalog`, `PetProfile`, `SimilarPets` are async.
- **Client Components** (`src/components/`): marked `"use client"`. Interactive UI only.
- `src/hooks/useDatabase.js` — single hook managing poll voting and newsletter subscription state. Persists via `localStorage`. Also drives the 5-theme color system by writing CSS custom property overrides onto `:root`.

### Styling

Global CSS custom properties define 5 color themes (`--base-1` through `--base-5`, `--primary-*`, `--secondary-*`). The active theme is switched at runtime by `useDatabase` → `updateColorTheme(n)`. Section layout uses utility classes defined in `global.css`: `.section`, `.section-content`, `.section.white`, `.section.primary-to-base`, etc. Components use CSS Modules (`.module.css` co-located files).

### Path alias

`@/*` resolves to `src/*` (configured in `jsconfig.json`).

### Environment variables

All four are required at build time (see `.env.local.example`; schema and setup steps are in `README.md`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project for Maceió. `NEXT_PUBLIC_` because inserts run in the browser.
- `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name.
- `CLOUDINARY_AUTH` — base64-encoded `api_key:api_secret`.

### City-specific places

When adapting copy or partners, these are the spots that carry city context: `src/app/layout.js` (metadata description), `src/components/Adopt.js` (phone mask uses DDD 82), `src/sections/Partners.js` (ONG logos/links), `src/utils.js` (`OngsMap` slug → display name), `src/sections/Footer.js` (Instagram link, currently a placeholder).
