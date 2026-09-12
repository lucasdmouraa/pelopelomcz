import { ParceirosAoVivo } from "@/components/ParceirosAoVivo";
import { getOngs } from "@/services/supabase";

// ONGs ativas: lista do build, atualizada com os dados ao vivo ao abrir.
export const Partners = async () => {
  const ongs = await getOngs();
  return <ParceirosAoVivo inicial={ongs} />;
};
