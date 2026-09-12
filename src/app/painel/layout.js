import { PainelShell } from "@/components/painel";

// O manifest fica só no painel: o site público não vira app instalável.
export const metadata = {
  title: "Painel · PeloPelo",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  themeColor: "#5d280a",
  appleWebApp: { capable: true, title: "PeloPelo", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export default function PainelLayout({ children }) {
  return <PainelShell>{children}</PainelShell>;
}
