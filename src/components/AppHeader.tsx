import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PLAN_EMOJI, PLAN_LABEL } from "@/lib/plans";

// Navegação principal: fica ao lado do logo a partir de md e, no mobile,
// vira a primeira seção da gaveta.
const MAIN_NAV = [
  { to: "/receitas", label: "receitas", authOnly: false },
  { to: "/minhas-receitas", label: "minhas receitas", authOnly: true },
  { to: "/minha-despensa", label: "minha despensa", authOnly: true },
  { to: "/planos", label: "planos", authOnly: false },
] as const;

export function AppHeader() {
  const { location } = useRouterState();
  const path = location.pathname;
  const { session, signOut } = useAuth();
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Deslogado sobram os itens públicos ("receitas" e "planos"), que continuam
  // no topo — a navbar não depende de sessão.
  const navItems = MAIN_NAV.filter((item) => !(item.authOnly && !session));

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate({ to: "/" });
  };

  const drawerLinkClass = (to: string) =>
    `text-sm py-2 transition ${path === to ? "text-blush" : "text-cream/70 hover:text-cream"}`;

  const sectionLabelClass = "text-xs uppercase tracking-[0.25em] text-cream/50";

  return (
    <header className="sticky top-0 z-50 bg-charcoal/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center gap-8">
        <Link
          to="/"
          className="font-display italic text-2xl text-blush tracking-tight font-mono shrink-0"
        >
          receitahub
        </Link>

        {/* Menu principal ao lado do logo; no mobile ele desce para a gaveta */}
        <nav className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative text-sm whitespace-nowrap transition ${
                  active ? "text-blush" : "text-cream/70 hover:text-cream"
                }`}
              >
                {item.label}
                {active && <span className="absolute -bottom-1.5 left-0 right-0 h-px bg-blush" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center shrink-0">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="abrir menu"
              className="text-cream p-2 -mr-2 transition hover:text-blush"
            >
              <Menu size={22} />
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[min(320px,85vw)] border-border bg-charcoal text-cream"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>

              <div className="mt-8 flex flex-col">
                {/* No desktop essa navegação já está no topo; aqui ela existe só no mobile */}
                <div className="flex flex-col md:hidden">
                  <p className={sectionLabelClass}>navegação</p>
                  <nav className="mt-3 flex flex-col">
                    {navItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={drawerLinkClass(item.to)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="h-px bg-border my-5" />
                </div>

                <p className={sectionLabelClass}>perfil</p>
                {session ? (
                  <div className="mt-3 flex flex-col">
                    {/* Plano contratado: também é o caminho para a assinatura */}
                    <Link
                      to="/minha-assinatura"
                      onClick={() => setOpen(false)}
                      className={`flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                        path === "/minha-assinatura"
                          ? "border-blush text-blush"
                          : "border-border text-cream/60 hover:border-blush hover:text-blush"
                      }`}
                    >
                      <span>{PLAN_EMOJI[tier]}</span>
                      plano {PLAN_LABEL[tier]}
                    </Link>
                    <Link
                      to="/perfil"
                      onClick={() => setOpen(false)}
                      className={`mt-3 truncate ${drawerLinkClass("/perfil")}`}
                    >
                      {session.user.email}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-sm py-2 text-left text-cream/70 transition hover:text-blush"
                    >
                      sair
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col">
                    <Link
                      to="/login"
                      onClick={() => setOpen(false)}
                      className={drawerLinkClass("/login")}
                    >
                      logar
                    </Link>
                    <Link
                      to="/cadastro"
                      onClick={() => setOpen(false)}
                      className="text-sm py-2 text-blush transition hover:text-blush-deep italic font-display"
                    >
                      cadastrar
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
