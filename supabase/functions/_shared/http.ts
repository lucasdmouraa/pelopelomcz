import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const erro = (mensagem: string, status = 400) =>
  json({ error: mensagem }, status);

// Projetos novos expõem as chaves novas (sb_secret_…) em SUPABASE_SECRET_KEYS
// (JSON por nome); os antigos, a service role legada.
const chaveSecreta = () => {
  try {
    const chaves = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (chaves.default) return chaves.default as string;
  } catch {
    // formato inesperado: cai na chave legada
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
};

// Cliente com a chave secreta: ignora RLS, por isso toda função confere o
// perfil do usuário antes de agir.
export const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveSecreta(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Perfil = {
  user_id: string;
  papel: "admin" | "ong";
  ong_id: number | null;
  funcao: "coordenacao" | "voluntario" | null;
};

export const getPerfil = async (req: Request): Promise<Perfil | null> => {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return null;

  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;

  const { data: perfil } = await admin
    .from("perfil")
    .select("user_id, papel, ong_id, funcao")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return perfil;
};

// Qualquer pessoa da equipe da ONG (rotina: fotos dos pets)
export const podeGerirOng = (perfil: Perfil, ongId: number) =>
  perfil.papel === "admin" || perfil.ong_id === ongId;

// Só a coordenação da ONG (apagar animal, logo, equipe)
export const podeCoordenarOng = (perfil: Perfil, ongId: number) =>
  perfil.papel === "admin" || (perfil.ong_id === ongId && perfil.funcao === "coordenacao");

// Envolve o handler com CORS, parse do corpo e checagem de login.
export const servir = (
  handler: (perfil: Perfil, body: Record<string, unknown>, req: Request) => Promise<Response>,
) =>
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return erro("Método não permitido", 405);

    const perfil = await getPerfil(req);
    if (!perfil) return erro("Faça login para continuar", 401);

    const body = await req.json().catch(() => ({}));
    try {
      return await handler(perfil, body, req);
    } catch (e) {
      console.error(e);
      return erro("Erro inesperado, tente novamente", 500);
    }
  });
