import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "receitahub:theme";

type ThemeValue = { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void };

const ThemeContext = createContext<ThemeValue>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

/**
 * Script que roda no <head>, antes da primeira pintura, para evitar o flash do
 * tema errado. É a única coisa que decide o tema inicial: preferência salva,
 * senão a do sistema, senão escuro. Depois disso o React só lê o que ele
 * escreveu em data-theme.
 *
 * Precisa ser uma string: o React não executa <script> renderizado normalmente.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // No SSR não há como saber o tema; o script inline já corrigiu o DOM antes da
  // hidratação, então sincronizamos no primeiro efeito.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof document !== "undefined") document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // aba anônima ou storage bloqueado: vale só para esta sessão
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  // Enquanto a pessoa nunca escolheu manualmente, acompanha o sistema ao vivo.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        // sem storage, seguir o sistema é o comportamento razoável
      }
      const next: Theme = e.matches ? "light" : "dark";
      setThemeState(next);
      document.documentElement.dataset.theme = next;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
