// Informação nutricional de uma receita calculada com a TACO.
// A IA só identifica, em cada ingrediente, o alimento da tabela e a medida; a
// conta (gramas, nutrientes, soma e divisão por porção) é feita aqui.

import { isMeasureUnit, toGrams, type MeasureUnit, type Size } from "./measures.ts";
import type { RecipeNutrition } from "./recipe-nutrition.ts";
import { nutrientsFor, resolveFood, sumNutrients, type Nutrients, type TacoFood } from "./taco.ts";

/** O que a IA devolve para cada ingrediente */
export type RawIngredient = {
  ingredient?: unknown;
  taco_id?: unknown;
  taco_name?: unknown;
  amount?: unknown;
  unit?: unknown;
  size?: unknown;
  /** Tempero ou item sem peso relevante (sal, pimenta, folha de louro) */
  negligible?: unknown;
};

export type ResolvedIngredient = {
  text: string;
  food: TacoFood | null;
  grams: number | null;
  approx: boolean;
  negligible: boolean;
  nutrients: Nutrients | null;
};

const SIZES: readonly Size[] = ["pequena", "média", "grande"];

export function resolveIngredient(raw: RawIngredient): ResolvedIngredient {
  const text = String(raw.ingredient ?? "")
    .trim()
    .slice(0, 160);
  const negligible = raw.negligible === true;
  const food = resolveFood(raw.taco_id, raw.taco_name);

  const amount = Number(raw.amount);
  const unit: MeasureUnit | null = isMeasureUnit(raw.unit) ? raw.unit : null;
  const size = SIZES.includes(raw.size as Size) ? (raw.size as Size) : "média";

  let grams: number | null = null;
  let approx = false;
  if (unit) {
    const conv = toGrams(Number.isFinite(amount) ? amount : 1, unit, food?.name ?? text, size);
    if (conv) {
      grams = conv.grams;
      approx = conv.approx;
    }
  }

  return {
    text,
    food,
    grams,
    approx,
    negligible,
    nutrients: food && grams !== null ? nutrientsFor(food, grams) : null,
  };
}

export type RecipeTotals = {
  nutrition: RecipeNutrition;
  /** Ingredientes que contaram na conta / ingredientes relevantes */
  matched: number;
  counted: number;
};

/** Mínimo de ingredientes relevantes com correspondência na tabela para valer o cálculo */
export const MIN_COVERAGE = 0.6;

/**
 * Soma os ingredientes e divide pelas porções. Devolve null quando a tabela
 * cobre pouco da receita (aí quem chamou usa outra estimativa).
 */
export function summarizeRecipe(
  items: ResolvedIngredient[],
  servings: number,
): RecipeTotals | null {
  const relevant = items.filter((i) => !i.negligible);
  if (relevant.length === 0 || servings < 1) return null;
  const matchedItems = relevant.filter((i) => i.nutrients !== null);
  if (matchedItems.length / relevant.length < MIN_COVERAGE) return null;

  const total = sumNutrients(matchedItems.map((i) => i.nutrients as Nutrients));
  // Os de peso desprezível que têm dado entram na soma sem pesar na cobertura
  const extra = items.filter((i) => i.negligible && i.nutrients);
  const all = extra.length
    ? sumNutrients([total, ...extra.map((i) => i.nutrients as Nutrients)])
    : total;
  if (all.kcal <= 0) return null;

  const per = (n: number) => Math.round(n / servings);
  return {
    nutrition: {
      calories: per(all.kcal),
      protein: per(all.protein),
      carbs: per(all.carbs),
      fat: per(all.fat),
      source: "taco",
      approx: [...matchedItems, ...extra].some((i) => i.approx),
      unmatched: relevant.filter((i) => i.nutrients === null).map((i) => i.text),
    },
    matched: matchedItems.length,
    counted: relevant.length,
  };
}
