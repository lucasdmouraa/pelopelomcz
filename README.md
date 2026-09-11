# PeloPelo Maceió

Landing page de adoção de animais em Maceió, Alagoas. O PeloPelo conecta pessoas interessadas em adotar com ONGs parceiras, exibindo um catálogo de pets disponíveis e facilitando o envio de interesse de adoção.

**Site:** a definir

> Este projeto é a versão de Maceió do PeloPelo, derivada da aplicação original de Campina Grande - PB. O código é o mesmo; mudam as ONGs parceiras, os contatos e o backend (Supabase e Cloudinary próprios).

---

## O que é

O PeloPelo é um projeto social criado por três desenvolvedores que acreditam na tecnologia como ferramenta de transformação. A aplicação funciona como vitrine digital para animais resgatados por abrigos e ONGs da região, permitindo que visitantes conheçam cada pet, vejam fotos e manifestem interesse em adotá-lo.

A missão do projeto é criar impacto significativo na vida dos animais por meio da inovação, apoiando organizações de proteção animal e contribuindo para um mundo onde todos os animais sejam tratados com respeito e dignidade.

---

## Para que serve

- **Divulgar animais disponíveis para adoção** — catálogo visual com fotos, idade, porte, sexo e ONG responsável.
- **Facilitar o primeiro contato** — formulário de interesse de adoção com nome, CPF e telefone, enviado diretamente ao banco de dados.
- **Dar visibilidade às ONGs parceiras** — seção dedicada com links para os perfis das organizações.
- **Apresentar o projeto** — seção institucional com missão e valores do PeloPelo.

---

## Funcionalidades

### Página inicial (`/`)

| Seção | Descrição |
|---|---|
| **Hero** | Chamada principal com convite à adoção e navegação para o catálogo |
| **Catálogo** | Grade de pets com paginação (8 por página), ordenação aleatória a cada build |
| **Quem Somos** | História do projeto, missão e valores (Compaixão, Inovação, Parceria, Transparência) |
| **Parceiros** | Logos e links das ONGs parceiras no Instagram |
| **Rodapé** | Logo, redes sociais e e-mail de contato |

### Página do pet (`/adote/[nome]`)

| Seção | Descrição |
|---|---|
| **Perfil** | Álbum de fotos interativo, informações detalhadas e status de saúde |
| **Adoção** | Modal com formulário validado (nome, CPF, telefone) para registrar interesse |
| **Semelhantes** | Até 4 pets com perfil parecido (espécie, sexo, porte, idade) |
| **Parceiros e Rodapé** | Mesmas seções da home |

### Outras funcionalidades

- **Indicadores de saúde** — ícones para vacina antirrábica, vermifugação, castração e necessidades especiais
- **Sistema de temas** — 5 paletas de cores que podem ser alternadas via enquete de mascote (componente `Poll`)
- **Enquete de mascote** — votação para escolher o focinho oficial do projeto, com inscrição em newsletter após votar
- **Analytics** — contagem de visitas via [GoatCounter](https://www.goatcounter.com/) (ativo apenas em produção)

---

## Tecnologias

| Categoria | Tecnologia |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router, export estático) |
| UI | [React](https://react.dev/) |
| Banco de dados | [Supabase](https://supabase.com/) |
| Imagens | [Cloudinary](https://cloudinary.com/) |
| Formulários | [React Hook Form](https://react-hook-form.com/) + [react-input-mask](https://github.com/sanniassin/react-input-mask) |
| Componentes | [Radix UI Dialog](https://www.radix-ui.com/) |
| Estilização | CSS Modules + variáveis CSS globais |
| Fontes | Suez One e Nunito (Google Fonts) |
| Utilitários | Ramda, clsx, just-shuffle, react-use |
| Qualidade | Husky + Prettier (formatação no pre-commit) |

---

## Arquitetura

A aplicação é **totalmente estática** (`output: "export"` no Next.js). Não há servidor em runtime — os dados dos pets são buscados em **build time** via Server Components assíncronos e `generateStaticParams`.

```
src/
├── app/              # Rotas (/, /adote/[pet])
├── sections/         # Server Components — seções de página
├── components/       # Client Components — UI interativa
├── services/         # Supabase e Cloudinary
├── hooks/            # Estado client-side (enquete, newsletter, temas)
├── icons/            # Ícones SVG customizados
└── global.css        # Variáveis de tema e classes utilitárias
```

### Camada de dados

- **Supabase** — tabelas `animal`, `adoption_request`, `votes` e `newsletter`
- **Cloudinary** — imagens organizadas por pasta com o `id` do pet; transformações `thumb`, `mini` e `full` aplicadas via URL

`getAnimals()` une os dois serviços: busca pets no Supabase, associa imagens do Cloudinary pelo `id` e embaralha o resultado.

### Parceiros

| ONG | Slug (coluna `ong`) | Links |
|---|---|---|
| Grupo Pata Amada | `pata-amada` | [Instagram](https://www.instagram.com/grupopataamada/) · [X](https://x.com/grupopataamada) |
| SOS Pet Pinheiro | `sos-pet-pinheiro` | [Instagram](https://www.instagram.com/sospetpinheiro/) · [Atados](https://www.atados.com.br/ong/sos-pet-pinheiro-323931) |
| Projeto Acolher Maceió | `projeto-acolher` | [Instagram](https://www.instagram.com/projetoacolher/) · [Adotar](https://adotar.com.br/instituicao/projeto-acolher) |

O slug é o valor que deve ir na coluna `ong` da tabela `animal`; o nome exibido vem do `OngsMap` em `src/utils.js`. Para adicionar uma ONG: incluir a logo em `public/`, o item em `src/sections/Partners.js` e o slug em `src/utils.js`.

---

## Como rodar localmente

### Pré-requisitos

- Node.js
- Um projeto Supabase e uma conta Cloudinary próprios (ver [Configurando o backend](#configurando-o-backend))

### Instalação

```bash
npm install
cp .env.local.example .env.local   # e preencha as 4 variáveis
```

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary → Dashboard → Cloud name |
| `CLOUDINARY_AUTH` | base64 de `api_key:api_secret` (`echo -n "key:secret" \| base64`) |

As duas primeiras usam o prefixo `NEXT_PUBLIC_` porque o formulário de adoção, a enquete e a newsletter gravam direto do browser. A chave anon é pública por design; a segurança fica nas políticas RLS do Supabase.

### Comandos

```bash
npm run dev    # servidor de desenvolvimento em localhost:3000
npm run build  # gera export estático na pasta /out
npm run lint   # ESLint via Next.js
```

---

## Configurando o backend

### Supabase

Crie as tabelas abaixo (nomes e colunas são os que o código usa):

| Tabela | Colunas | Observações |
|---|---|---|
| `animal` | `id` (int, PK), `created_at` (timestamptz), `nome` (text, único), `especie` (`gato` ou `cachorro`), `sexo` (`macho` ou `femea`), `porte` (`pequeno`, `medio`, `grande`, `gigante`), `idade` (text), `ong` (slug da tabela de parceiros), `vacinado`, `vermifugado`, `castrado`, `especial` (bool) | `nome` é usado na URL `/adote/[nome]` |
| `adoption_request` | `id`, `created_at`, `name` (text), `contact` (text), `cpf` (text), `pet_id` (int → `animal.id`) | preenchida pelo formulário "Quero Adotar" |
| `votes` | `id`, `created_at`, `option` (int 1–5) | enquete de mascote |
| `newsletter` | `id`, `created_at`, `email` (text) | inscrição após votar |

Políticas RLS para a role `anon`: `SELECT` em `animal`; `INSERT` em `adoption_request`, `votes` e `newsletter`.

### Cloudinary

- Cada pet tem uma **pasta nomeada com o seu `id`** da tabela `animal` (ex.: `12/foto1.jpg`). A primeira imagem encontrada vira a capa no catálogo; todas aparecem no álbum do perfil.
- Crie as **named transformations** `t_media_lib_thumb`, `t_mini` e `t_full` (Settings → Transformations), usadas por `applyTransformation` em `src/services/cloudinary.js`.
- Pets sem pasta no Cloudinary aparecem sem imagem, mas não quebram o build.

---

## Contato

- **E-mail:** contato@pelopelo.org
- **Instagram:** a definir (o rodapé aponta provisoriamente para `@pelopelomcz`)

---

*PeloPelo — Fazendo a diferença na causa animal*
