import { PainelShell } from "@/components/painel";

export const metadata = {
  title: "Painel · PeloPelo",
  robots: { index: false, follow: false },
};

export default function PainelLayout({ children }) {
  return <PainelShell>{children}</PainelShell>;
}
