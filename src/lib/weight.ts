import { useCallback, useEffect, useState } from "react";

// Peso corporal usado para mostrar os macronutrientes em gramas por kg.
// Fica só no navegador (localStorage) e é compartilhado entre a tela de
// receitas e o formulário do plano alimentar. Nada disso é enviado ao servidor
// por este módulo.

const WEIGHT_KEY = "receitahub:peso-kg";
// Chave do formulário do plano alimentar (src/routes/dieta.tsx)
const DIET_FORM_KEY = "receitahub:dieta-corpo";

export const WEIGHT_LIMITS = { min: 30, max: 300 } as const;

function validWeight(n: number): boolean {
  return Number.isFinite(n) && n >= WEIGHT_LIMITS.min && n <= WEIGHT_LIMITS.max;
}

export function readStoredWeight(): number | null {
  try {
    const direct = Number(localStorage.getItem(WEIGHT_KEY)?.replace(",", "."));
    if (validWeight(direct)) return direct;
    const form = localStorage.getItem(DIET_FORM_KEY);
    if (form) {
      const fromForm = Number(
        String((JSON.parse(form) as { weight?: string }).weight ?? "").replace(",", "."),
      );
      if (validWeight(fromForm)) return fromForm;
    }
  } catch {
    /* sem storage: segue sem peso */
  }
  return null;
}

export function storeWeight(kg: number | null): void {
  try {
    if (kg !== null && validWeight(kg)) localStorage.setItem(WEIGHT_KEY, String(kg));
    else localStorage.removeItem(WEIGHT_KEY);
  } catch {
    /* ignorado */
  }
}

/** Peso guardado no navegador. Começa nulo e é lido depois da montagem (evita divergência no SSR). */
export function useStoredWeight(): [number | null, (kg: number | null) => void] {
  const [weight, setWeight] = useState<number | null>(null);
  useEffect(() => {
    setWeight(readStoredWeight());
  }, []);
  const update = useCallback((kg: number | null) => {
    setWeight(kg);
    storeWeight(kg);
  }, []);
  return [weight, update];
}

/** Gramas por kg de peso corporal, com vírgula: 1,8 */
export function formatPerKg(grams: number, weightKg: number): string {
  return (grams / weightKg).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}
