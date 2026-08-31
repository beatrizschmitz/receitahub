import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { PlanGateProvider } from "@/contexts/PlanGateContext";
import { PantryChat } from "@/components/PantryChat";
import { AppHeader } from "@/components/AppHeader";
import { OG_IMAGE_URL } from "@/lib/site";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "receitahub" },
      { name: "description", content: "An AI-powered recipe app with a pantry manager and chat assistant." },
      { name: "author", content: "receitahub" },
      { property: "og:title", content: "receitahub" },
      { property: "og:description", content: "An AI-powered recipe app with a pantry manager and chat assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "receitahub" },
      { name: "twitter:description", content: "An AI-powered recipe app with a pantry manager and chat assistant." },
      { property: "og:image", content: OG_IMAGE_URL },
      { name: "twitter:image", content: OG_IMAGE_URL },
      // Nome do atalho quando o site é salvo na tela de início do iOS
      { name: "apple-mobile-web-app-title", content: "receitahub" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Favicons (public/, gerados pelo RealFaviconGenerator). Não há index.html
      // neste projeto — o shell HTML vem do RootShell abaixo, então é aqui que
      // as tags precisam estar para o HeadContent renderizá-las.
      { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      // .ico fica por último: navegadores antigos param no primeiro que entendem
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <SubscriptionProvider>
            <PlanGateProvider>
              {children}
              <PantryChat />
            </PlanGateProvider>
          </SubscriptionProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
