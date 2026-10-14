// Informação nutricional de uma receita, por porção. Sem dependências, para
// poder ser testada e usada no servidor e no navegador.

export type RecipeNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** De onde vêm os números: tabela TACO ou estimativa da IA (padrão, para dados antigos) */
  source?: "taco" | "ia";
  /** Houve medida caseira convertida em gramas (colher, xícara, unidade...) */
  approx?: boolean;
  /** Ingredientes sem correspondente na tabela, deixados de fora da conta */
  unmatched?: string[];
};

const toNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Valida qualquer valor vindo do banco ou da IA. Devolve null se estiver incompleto ou sem calorias. */
export function parseNutrition(value: unknown): RecipeNutrition | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const calories = toNumber(o.calories);
  const protein = toNumber(o.protein);
  const carbs = toNumber(o.carbs);
  const fat = toNumber(o.fat);
  if (calories === null || protein === null || carbs === null || fat === null) return null;
  if (calories <= 0) return null;
  const out: RecipeNutrition = {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
  if (o.source === "taco" || o.source === "ia") out.source = o.source;
  if (typeof o.approx === "boolean") out.approx = o.approx;
  if (Array.isArray(o.unmatched)) {
    out.unmatched = o.unmatched.filter((x): x is string => typeof x === "string").slice(0, 20);
  }
  return out;
}

/** Calorias a partir dos macros (4 kcal/g de proteína e carboidrato, 9 kcal/g de gordura). */
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

/** Monta a informação nutricional de uma receita a partir dos macros, com calorias consistentes. */
export function nutritionFromMacros(
  protein: number,
  carbs: number,
  fat: number,
): RecipeNutrition | null {
  return parseNutrition({
    protein,
    carbs,
    fat,
    calories: caloriesFromMacros(protein, carbs, fat),
  });
}
