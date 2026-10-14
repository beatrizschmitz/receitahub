import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { estimateRecipeNutrition } from "@/lib/ai.functions";
import { parseNutrition, type RecipeNutrition } from "@/lib/recipe-nutrition";

export type NutritionStatus = "ready" | "loading" | "error" | "unavailable";

type Options = {
  title: string;
  ingredients: string[] | null | undefined;
  /** Porções que a lista de ingredientes rende (o app usa 4 quando não sabe) */
  servings?: number;
  /** Valor que a receita já tem (da IA na geração ou do banco). Se válido, nada é calculado. */
  initial: unknown;
  /** Só quem está logado pode pedir a estimativa (a função do servidor exige sessão) */
  canEstimate: boolean;
  /** Texto da receita (descrição, modo de preparo): permite estimar mesmo sem lista de ingredientes */
  context?: string | null;
  /** Calorias já conhecidas, para a estimativa ficar coerente com elas */
  knownCalories?: number | null;
  /**
   * Receita com números antigos da IA (sem `source`): recalcula com a TACO. Só vale onde o
   * resultado é guardado (Minhas receitas), para não gastar IA a cada abertura.
   */
  upgradeAi?: boolean;
  /** Chamado quando uma estimativa nova chega (para guardar na receita salva) */
  onEstimated?: (nutrition: RecipeNutrition) => void;
};

// Mesma receita aberta duas vezes na sessão não gasta duas chamadas de IA
const sessionCache = new Map<string, RecipeNutrition>();

/**
 * Informação nutricional de uma receita: usa a que ela já tem e, quando falta,
 * calcula uma vez (estimativa via IA) e avisa quem chamou para guardar.
 */
export function useRecipeNutrition(opts: Options): {
  nutrition: RecipeNutrition | null;
  status: NutritionStatus;
  retry: () => void;
} {
  const parsed = parseNutrition(opts.initial);
  // Valor antigo da IA, sem fonte registrada: pode ser trocado pelo cálculo com a TACO
  const upgradable = Boolean(opts.upgradeAi && parsed && parsed.source === undefined);
  const given = upgradable ? null : parsed;
  const estimate = useServerFn(estimateRecipeNutrition);
  const [estimated, setEstimated] = useState<RecipeNutrition | null>(null);
  const [status, setStatus] = useState<NutritionStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const onEstimated = useRef(opts.onEstimated);
  onEstimated.current = opts.onEstimated;

  const ingredientsKey = (opts.ingredients ?? []).join(";");
  const cacheKey =
    `${opts.title}|${opts.servings ?? 4}|${ingredientsKey}|${(opts.context ?? "").slice(0, 80)}`.toLowerCase();
  const hasIngredients =
    (opts.ingredients?.length ?? 0) > 0 || (opts.context ?? "").trim().length >= 20;

  useEffect(() => {
    setEstimated(null);
    if (given) {
      setStatus("ready");
      return;
    }
    const cached = sessionCache.get(cacheKey);
    if (cached) {
      setEstimated(cached);
      setStatus("ready");
      return;
    }
    if (!opts.canEstimate || !hasIngredients) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    estimate({
      data: {
        title: opts.title,
        ingredients: opts.ingredients ?? [],
        context: opts.context ?? undefined,
        servings: opts.servings ?? 4,
        knownCalories: opts.knownCalories ?? undefined,
      },
    })
      .then(({ nutrition }) => {
        if (cancelled) return;
        if (!nutrition) {
          setStatus("error");
          return;
        }
        sessionCache.set(cacheKey, nutrition);
        setEstimated(nutrition);
        setStatus("ready");
        onEstimated.current?.(nutrition);
      })
      .catch((e) => {
        console.error("informação nutricional", e);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // `given` muda de identidade a cada render; o que importa é o conteúdo da receita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, opts.canEstimate, hasIngredients, attempt, JSON.stringify(opts.initial)]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Durante a troca da estimativa antiga pela da TACO, segue mostrando a antiga
  const shown = given ?? estimated ?? (upgradable ? parsed : null);
  return { nutrition: shown, status: shown ? "ready" : status, retry };
}
