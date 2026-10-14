import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, ChevronDown, Menu, Moon, Salad, Sparkles, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OPEN_CHAT_PHOTO_EVENT } from "@/components/PantryChat";
import {
  GATED_FEATURES,
  PLAN_ICON,
  PLAN_ICONS,
  PLAN_LABEL,
  planAtLeast,
  type GatedFeature,
} from "@/lib/plans";

// Navegação principal: a partir de lg (1024px) ocupa o vão entre o logo e o
// menu, centralizada nele; abaixo disso — tablet e celular — vira a primeira
// seção da gaveta.
const MAIN_NAV = [
  { to: "/receitas", label: "Receitas", authOnly: false },
  { to: "/minhas-receitas", label: "Minhas receitas", authOnly: true },
  { to: "/minha-despensa", label: "Minha despensa", authOnly: true },
  { to: "/planos", label: "Planos", authOnly: false },
] as const;

export function AppHeader() {
  const { location } = useRouterState();
  const path = location.pathname;
  const { session, signOut } = useAuth();
  const { tier } = useSubscription();
  const { theme, toggleTheme } = useTheme();
  const PlanIcon = PLAN_ICONS[PLAN_ICON[tier]];
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Quem não tem o plano da função vai direto para a página de planos;
  // quem tem, usa a função.
  const openFeature = (feature: GatedFeature, run: () => void) => {
    if (planAtLeast(tier, GATED_FEATURES[feature].minimum)) run();
    else navigate({ to: "/planos" });
  };

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

  const sectionLabelClass = "text-sm text-cream/45";

  return (
    <header className="sticky top-0 z-50 bg-charcoal/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center gap-8">
        <Link
          to="/"
          className="font-display italic text-2xl text-blush tracking-tight font-mono shrink-0"
        >
          receitahub
        </Link>

        {/* flex-1 + justify-center centraliza os links no espaço que sobra entre o
            logo e o hambúrguer — diferente de centralizar na barra inteira, que
            com 4 links encostaria no logo perto de 1024px. */}
        <nav className="hidden lg:flex flex-1 justify-center items-center gap-7">
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

        {/* ml-auto é no-op quando o nav tem flex-1; serve abaixo de lg, onde o
            nav está hidden e nada mais empurra o botão para a direita. */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {/* Menu "Premium": atalho para as funções de assinante (plano alimentar
              e reconhecimento por foto) e para a página de planos. Visível para
              todos; quem já é Premium vê "Recursos". O plano é checado ao clicar:
              se não liberar, leva para a página de planos. */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full border border-blush/40 bg-blush/10 px-4 py-1.5 text-sm text-blush light:text-blush-deep transition hover:bg-blush/20 outline-none">
              <Sparkles size={14} strokeWidth={1.5} />
              {tier === "premium" ? "Recursos" : "Premium"}
              <ChevronDown size={13} strokeWidth={1.5} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 border-border bg-charcoal text-cream">
              <DropdownMenuItem
                className="flex cursor-pointer items-start gap-3 py-2.5 focus:bg-blush/10 focus:text-cream"
                onSelect={() => {
                  openFeature("dieta", () => navigate({ to: "/dieta" }));
                }}
              >
                <Salad size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-blush" />
                <span className="flex flex-col">
                  <span className="text-sm">
                    Plano alimentar <span className="ml-1 text-xs text-blush">Premium</span>
                  </span>
                  <span className="text-xs text-cream/55">Cardápio de 7 dias com calorias</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex cursor-pointer items-start gap-3 py-2.5 focus:bg-blush/10 focus:text-cream"
                onSelect={() => {
                  openFeature("foto", () => window.dispatchEvent(new Event(OPEN_CHAT_PHOTO_EVENT)));
                }}
              >
                <Camera size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-blush" />
                <span className="flex flex-col">
                  <span className="text-sm">
                    Reconhecimento por foto{" "}
                    <span className="ml-1 text-xs text-blush">Básico e Premium</span>
                  </span>
                  <span className="text-xs text-cream/55">
                    Fotografe um ingrediente e receba uma receita
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Entrar direto na barra: antes só dava pra logar abrindo a gaveta
              do menu e descendo até "Perfil" — pouco óbvio pra quem chega
              pela primeira vez. Fica visível sempre que não há sessão. */}
          {!session && (
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm text-cream/80 transition hover:border-blush hover:text-blush"
            >
              Entrar
            </Link>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Abrir menu"
              className="text-cream p-2 -mr-2 transition hover:text-blush"
            >
              <Menu size={22} />
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[min(320px,85vw)] border-border bg-charcoal text-cream"
            >
              {/* Radix avisa no console quando o conteúdo não tem descrição;
                  ambos são só para leitor de tela. */}
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Navegação do site, acesso à sua assinatura e opção de sair da conta.
              </SheetDescription>

              <div className="mt-8 flex flex-col">
                {/* Acima de lg a navegação já está no topo; aqui ela só existe abaixo disso */}
                <div className="flex flex-col lg:hidden">
                  <p className={sectionLabelClass}>Navegação</p>
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

                <div className="flex flex-col">
                  <p className={sectionLabelClass}>Aparência</p>
                  <button
                    onClick={toggleTheme}
                    className="mt-3 flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-cream/70 transition hover:border-blush hover:text-blush"
                    aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
                  >
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    Modo {theme === "dark" ? "claro" : "escuro"}
                  </button>
                  <div className="h-px bg-border my-5" />
                </div>

                <p className={sectionLabelClass}>Perfil</p>
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
                      <PlanIcon size={13} strokeWidth={1.5} />
                      Plano {PLAN_LABEL[tier]}
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
                      Sair
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col">
                    <Link
                      to="/login"
                      onClick={() => setOpen(false)}
                      className={drawerLinkClass("/login")}
                    >
                      Logar
                    </Link>
                    <Link
                      to="/cadastro"
                      onClick={() => setOpen(false)}
                      className="text-sm py-2 text-blush transition hover:text-blush-deep italic font-display"
                    >
                      Cadastrar
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
