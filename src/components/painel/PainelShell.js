"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import c from "clsx";
import { db } from "@/services/supabase";
import { carregarPerfil, contarPedidosNovos } from "@/services/painel";
import styles from "./Painel.module.css";

const PainelContext = createContext(null);
export const usePainel = () => useContext(PainelContext);

const ROTAS_PUBLICAS = ["/painel/login", "/painel/definir-senha"];

const menu = (perfil) => [
  { href: "/painel", rotulo: "Pets", ativo: ["/painel", "/painel/pet"] },
  {
    href: "/painel/pedidos",
    rotulo: "Pedidos de adoção",
    ativo: ["/painel/pedidos"],
    contador: true,
  },
  perfil.papel === "admin"
    ? {
        href: "/painel/ongs",
        rotulo: "ONGs e acessos",
        ativo: ["/painel/ongs", "/painel/ong"],
      }
    : { href: "/painel/ong", rotulo: "Minha ONG", ativo: ["/painel/ong"] },
];

export const PainelShell = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  // undefined = carregando; null = sem sessão / sem perfil vinculado
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);
  const [pedidosNovos, setPedidosNovos] = useState(0);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_evento, novaSessao) =>
      setSession(novaSessao),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const carregandoSessao = session === undefined;
  const userId = session?.user.id;

  useEffect(() => {
    if (carregandoSessao) return;
    if (!userId) return setPerfil(null);
    setPerfil(undefined);
    carregarPerfil(userId)
      .then(setPerfil)
      .catch(() => setPerfil(null));
  }, [carregandoSessao, userId]);

  const recarregarPerfil = useCallback(
    () => carregarPerfil(userId).then(setPerfil),
    [userId],
  );

  const recarregarPedidos = useCallback(() => {
    if (perfil) contarPedidosNovos().then(setPedidosNovos);
  }, [perfil]);

  useEffect(() => {
    recarregarPedidos();
  }, [recarregarPedidos, pathname]);

  const publica = ROTAS_PUBLICAS.includes(pathname);

  useEffect(() => {
    if (!publica && session === null) router.replace("/painel/login");
  }, [publica, session, router]);

  const sair = async () => {
    await db.auth.signOut();
    router.replace("/painel/login");
  };

  const contexto = {
    session,
    perfil,
    isAdmin: perfil?.papel === "admin",
    recarregarPerfil,
    recarregarPedidos,
    sair,
  };

  let conteudo;
  if (publica) {
    conteudo = <div className={styles.publicShell}>{children}</div>;
  } else if (carregandoSessao || (session && perfil === undefined)) {
    conteudo = <div className={styles.loading}>Carregando…</div>;
  } else if (!session) {
    conteudo = null;
  } else if (!perfil) {
    conteudo = (
      <div className={styles.publicShell}>
        <div className={styles.authCard}>
          <h1>Acesso pendente</h1>
          <p>
            Seu usuário ainda não está vinculado a nenhuma ONG. Fale com o
            administrador do PeloPelo.
          </p>
          <button className={c(styles.btn, styles.btnGhost)} onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    );
  } else {
    conteudo = (
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/painel" className={styles.brand}>
            <img src="/1.webp" alt="" />
            <span>
              <strong>PeloPelo · Painel</strong>
              <small>{perfil.ong?.nome ?? "Administrador"}</small>
            </span>
          </Link>
          <nav className={styles.nav}>
            {menu(perfil).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={c(
                  styles.navLink,
                  item.ativo.includes(pathname) && styles.navActive,
                )}
              >
                {item.rotulo}
                {item.contador && pedidosNovos > 0 && (
                  <span className={styles.navBadge}>{pedidosNovos}</span>
                )}
              </Link>
            ))}
            <a href="/" target="_blank" className={styles.navLink}>
              Ver site
            </a>
            <button className={styles.navLink} onClick={sair}>
              Sair
            </button>
          </nav>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    );
  }

  return (
    <PainelContext.Provider value={contexto}>{conteudo}</PainelContext.Provider>
  );
};
