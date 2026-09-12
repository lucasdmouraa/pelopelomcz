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

O **site público** é **estático** (`output: "export"` no Next.js): as páginas são geradas no build via Server Components assíncronos e `generateStaticParams`. E também **ao vivo**: ao abrir, catálogo, perfil do pet, semelhantes e parceiros buscam os dados atuais no banco, então foto, situação e pet novo aparecem na hora. Um pet publicado depois do último build ainda não tem página gerada; o Cloudflare serve a página de 404, que reconhece `/adote/<slug>` e monta o perfil ao vivo. O **painel** (`/painel`) também é exportado como páginas estáticas, mas roda todo no browser, falando direto com o Supabase com a sessão de quem está logado.

```
src/
├── app/
│   ├── adote/[pet]/  # Página do pet (/adote/mel-12)
│   └── painel/       # Painel das ONGs e do admin (client-side)
├── sections/         # Server Components — seções do site
├── components/       # Client Components — UI interativa
│   └── painel/       # Componentes e estilos do painel
├── services/         # supabase.js (site), painel.js (painel), cloudinary.js (URLs)
├── hooks/            # Estado client-side (enquete, newsletter, temas)
├── icons/            # Ícones SVG customizados
└── global.css        # Variáveis de tema e classes utilitárias
supabase/
├── migrations/       # Schema, RLS, triggers e publicação automática
├── functions/        # Edge Functions: cloudinary (upload assinado) e convidar (acessos)
└── seed.sql          # Pets de exemplo (só no ambiente local)
```

### Camada de dados

| Tabela | Para quê |
|---|---|
| `ong` | ONGs parceiras (nome, logo, links, `ativa`). Alimenta a seção Parceiros |
| `perfil` | Liga um usuário do Supabase Auth a um papel: `admin` ou `ong` (com `ong_id` e `funcao`: `coordenacao` ou `voluntario`) |
| `animal` | Pets. O `slug` (`mel-12`) é gerado pelo banco e vira a URL; `status` é `em_avaliacao` (recém-chegado), `disponivel`, `em_processo`, `adotado`, `morador` ou `falecido` — só `disponivel` aparece no site |
| `animal_ficha` | Ficha interna: entrada, origem do resgate, microchip, óbito (nunca vai ao site) |
| `evento_saude` | Prontuário: vacinas, vermífugos, consultas, exames, cirurgias, peso, com próxima data que vira lembrete |
| `tratamento`, `dose` | Remédios com horários; as doses previstas são geradas pelo banco (`doses_previstas`) e só a dose dada vira linha, com quem deu e quando |
| `documento` | Documentos privados no Supabase Storage (bucket `documentos`, pastas `equipe` e `restrito`) |
| `foto` | `public_id` das fotos no Cloudinary e a `ordem` (a primeira é a capa) |
| `adoption_request` | Pedidos do "Quero Adotar" e o andamento (`status`, `observacao`) controlado pela ONG |
| `votes`, `newsletter` | Enquete de mascote e inscrições |
| `site_estado` | Controla quando o site precisa ser reconstruído |

A segurança está toda nas **políticas RLS** (`supabase/migrations/`): o visitante só lê pets disponíveis de ONGs ativas; cada ONG lê e altera apenas os próprios pets, fotos e pedidos (os pedidos têm CPF — LGPD); o admin vê tudo. O que precisa de segredo roda nas **Edge Functions**:

- `cloudinary` — assina o upload direto do browser para a pasta do pet (`pets/<id>/`) ou para a logo da ONG, e apaga fotos.
- `convidar` — cria acessos e gera o link para a pessoa definir a senha (não depende de e-mail).

As imagens são servidas pelo Cloudinary com as transformações na própria URL (`imageUrl(public_id, 'thumb'|'mini'|'full')` em `src/services/cloudinary.js`), sem nada para configurar na conta.

### Publicação automática

O site mostra as mudanças na hora (dados ao vivo), mas o HTML gerado no build é o que as prévias de link do WhatsApp e o Google leem, então ele continua sendo refeito automaticamente. Toda alteração em `animal`, `foto` ou `ong` marca `site_estado.alterado_em`; um job do `pg_cron` roda a cada 5 minutos e, se houve mudança (e nenhuma nos últimos 3 minutos, para agrupar uma sessão de edição num build só), chama o **deploy hook** do Cloudflare Pages — no máximo um build a cada 10 minutos. O admin também tem o botão "Publicar agora" no painel.

### Painel (`/painel`)

Três perfis de acesso: **admin** (todas as ONGs), **coordenação** da ONG e **voluntário(a)**.

| Página | Voluntário(a) | Coordenação | Admin |
|---|---|---|---|
| **Hoje** (`/painel/hoje`) | Doses do dia (Dei / Pulei, com quem deu) e vacinas vencendo | Idem + pedidos novos | Idem, de todas as ONGs |
| **Pets** (`/painel`) | Pets da ONG por situação | Idem | Todos, com filtro por ONG, e "Publicar agora" |
| **Pet** (`/painel/pet?id=`) | Dados, ficha, saúde, remédios, documentos da equipe e fotos; cadastra pets (nascem "recém-chegado") | Tudo, inclusive mudar a situação (publicar, adotado…), documentos restritos e excluir | Idem |
| **Pedidos de adoção** | — | Pedidos dos seus pets: andamento, anotações, WhatsApp | Todos |
| **Equipe** / **Minha ONG** | — | Convida e remove voluntários; perfil e logo da ONG | — |
| **ONGs e acessos** | — | — | Cadastra ONGs, ativa/desativa, gerencia todos os acessos |

Não existe cadastro público: o admin (ou a coordenação, para voluntários da própria ONG) gera um **link de acesso** (vale 24 h, uso único) e envia por WhatsApp; a pessoa abre e cria a senha. O mesmo botão ("Novo link de acesso") serve de "esqueci minha senha". O token só é validado quando a pessoa envia o formulário, para que a prévia de link do WhatsApp não o consuma.

**No celular:** o painel é instalável como app. No Android (Chrome), menu **⋮ → Instalar app**; no iPhone (Safari), **Compartilhar → Adicionar à Tela de Início** (no iPhone o app pede login de novo). Ele abre direto na tela **Hoje**.

**Testes:** `supabase/tests/rls.sql` testa todas as regras de acesso contra o projeto vinculado sem deixar rastro (tudo roda numa transação desfeita no fim): `supabase db query --linked -f supabase/tests/rls.sql` — o relatório vem na mensagem de erro final. `supabase/tests/e2e_equipe.sh` e `e2e_documentos.sh` testam as Edge Functions e o Storage de ponta a ponta, criando e apagando usuários, pets e arquivos de teste.

### Parceiros

As ONGs são cadastradas pelo admin no painel (**ONGs e acessos → Nova ONG**). As três iniciais já vêm na migration, com as logos em `public/`:

| ONG | Slug | Links |
|---|---|---|
| Grupo Pata Amada | `pata-amada` | [Instagram](https://www.instagram.com/grupopataamada/) · [X](https://x.com/grupopataamada) |
| SOS Pet Pinheiro | `sos-pet-pinheiro` | [Instagram](https://www.instagram.com/sospetpinheiro/) · [Atados](https://www.atados.com.br/ong/sos-pet-pinheiro-323931) |
| Projeto Acolher Maceió | `projeto-acolher` | [Instagram](https://www.instagram.com/projetoacolher/) · [Adotar](https://adotar.com.br/instituicao/projeto-acolher) |

---

## Como rodar localmente

### Pré-requisitos

- Node.js 20+
- [Docker](https://www.docker.com/) e [Supabase CLI](https://supabase.com/docs/guides/cli), para subir o banco local já com o schema e pets de exemplo

### Instalação

```bash
npm install
supabase start                      # Postgres, Auth e Edge Functions locais + migrations + seed
cp .env.local.example .env.local    # preencha com a URL e a chave mostradas pelo `supabase start`
```

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local: `http://127.0.0.1:54321`. Produção: Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local: chave pública do `supabase status`. Produção: Supabase → Project Settings → API Keys → *Publishable key* (`sb_publishable_…`) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary → Dashboard → Cloud name |

As três são públicas por design (vão para o browser); a segurança fica nas políticas RLS e nas Edge Functions.

Para usar o painel localmente, crie um admin como em [Primeiro administrador](#primeiro-administrador), pelo Studio local (http://127.0.0.1:54323). O upload de fotos local precisa de credenciais reais do Cloudinary em `supabase/functions/.env` (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; arquivo fora do git).

### Comandos

```bash
npm run dev    # servidor de desenvolvimento em localhost:3000
npm run build  # gera export estático na pasta /out
npm run lint   # ESLint via Next.js
```

---

## Configurando o backend (produção)

### 1. Cloudinary

Crie a conta e anote, em **Settings → API Keys**, o `Cloud name`, a `API Key` e o `API Secret`. Não é preciso criar pastas nem transformações: as pastas (`pets/<id>/`, `ongs/<id>/`) nascem no upload e as transformações vão na URL. O `API Secret` fica **só** nas Edge Functions, nunca no site.

### 2. Supabase

1. Crie o projeto (região São Paulo, `sa-east-1`) e, no terminal:

   ```bash
   supabase login
   supabase link --project-ref <ref-do-projeto>
   supabase db push      # aplica supabase/migrations (schema, RLS, cron, ONGs iniciais)
   supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
   supabase functions deploy cloudinary --no-verify-jwt
   supabase functions deploy convidar --no-verify-jwt
   ```

   `--no-verify-jwt` porque as funções validam o token do usuário internamente (`supabase/functions/_shared/http.ts`).

2. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up** (o acesso é só por convite). No provedor **Email**, mude **Email OTP Expiration** para `86400` (24 h, a validade do link de acesso).
3. **Authentication → URL Configuration**: `Site URL` = endereço do site em produção.

> O plano gratuito do Supabase pausa o projeto depois de 7 dias sem uso. Com o site estático, só o painel e o formulário de adoção acessam o banco; se as ONGs ficarem uma semana sem entrar, o projeto precisa ser reativado no dashboard.

#### Primeiro administrador

Em **Authentication → Users → Add user → Create new user**, crie seu usuário com e-mail e senha (marque *Auto Confirm User*). Depois, no **SQL Editor**:

```sql
insert into public.perfil (user_id, papel, nome, email)
select id, 'admin', 'Seu nome', email from auth.users where email = 'voce@exemplo.com';
```

Os próximos acessos (de ONGs ou de outros admins) são criados pelo próprio painel.

### 3. Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
2. Build: preset **Next.js (Static HTML Export)**, comando `npm run build`, pasta de saída `out`.
3. **Environment variables**: as três `NEXT_PUBLIC_*` de produção e `NODE_VERSION` = `24` (mesma versão usada no desenvolvimento). Atenção ao comando: é `npm run build`, não `npx run build`.
4. **Settings → Builds → Deploy hooks**: crie um hook para a branch `main` e guarde a URL no Vault do Supabase, pelo **SQL Editor**:

   ```sql
   select vault.create_secret('https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...', 'deploy_hook_url');
   ```

   A partir daí, as alterações feitas no painel entram no ar sozinhas. O plano gratuito do Cloudflare Pages permite 500 builds por mês; a publicação automática faz no máximo 6 por hora, e só quando há alteração.
5. Configure o domínio em **Custom domains** e atualize o `Site URL` do Supabase.

---

## Contato

- **E-mail:** contato@pelopelo.org
- **Instagram:** a definir (o rodapé aponta provisoriamente para `@pelopelomcz`)

---

*PeloPelo — Fazendo a diferença na causa animal*
