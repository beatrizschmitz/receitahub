// Consulta e cálculo com a TACO (Tabela Brasileira de Composição de Alimentos,
// NEPA/UNICAMP, 4ª ed., 2011). Funções puras: servem ao servidor e aos testes.
// Imports relativos com extensão para rodar também no executor de testes do Node.

import { TACO_GROUPS, TACO_ROWS, TACO_SOURCE } from "../data/taco.ts";

export { TACO_SOURCE };

export type TacoFood = {
  id: number;
  name: string;
  group: string;
  /** por 100 g */
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sodiumMg: number | null;
  /** Preenchido quando o valor foi derivado de outra entrada da própria tabela */
  derivedFrom?: string;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const base: TacoFood[] = TACO_ROWS.map(
  ([id, name, group, kcal, protein, fat, carbs, fiber, sodiumMg]) => ({
    id,
    name,
    group: TACO_GROUPS[group] ?? "",
    kcal,
    protein,
    fat,
    carbs,
    fiber,
    sodiumMg,
  }),
);

const byId = new Map(base.map((f) => [f.id, f]));

/**
 * O leite de vaca líquido vem sem valor na TACO (marcado com "*"); só o leite em
 * pó tem dados. Os valores do líquido são calculados DA PRÓPRIA TABELA,
 * reconstituindo o pó na diluição padrão: integral a 13% (130 g por litro) e
 * desnatado a 10% (100 g por litro).
 */
function reconstituted(powderId: number, share: number, id: number, name: string): TacoFood | null {
  const p = byId.get(powderId);
  if (!p) return null;
  return {
    ...p,
    id,
    name,
    kcal: round1(p.kcal * share),
    protein: round2(p.protein * share),
    fat: round2(p.fat * share),
    carbs: round2(p.carbs * share),
    fiber: p.fiber === null ? null : round2(p.fiber * share),
    sodiumMg: p.sodiumMg === null ? null : round1(p.sodiumMg * share),
    derivedFrom: `${p.name} (TACO ${p.id}), diluído a ${Math.round(share * 100)}%`,
  };
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const TACO_FOODS: readonly TacoFood[] = [
  ...base,
  ...[
    reconstituted(459, 0.13, 458, "Leite, de vaca, integral"),
    reconstituted(456, 0.1, 457, "Leite, de vaca, desnatado, UHT"),
  ].filter((f): f is TacoFood => f !== null),
].sort((a, b) => a.id - b.id);

const foodById = new Map(TACO_FOODS.map((f) => [f.id, f]));
const foodByName = new Map(TACO_FOODS.map((f) => [normalize(f.name), f]));

export function getFood(id: number): TacoFood | undefined {
  return foodById.get(id);
}

/**
 * Resolve o alimento que a IA citou. O nome exato vale mais que o id (a IA
 * erra número com mais facilidade que nome); com os dois, o nome desempata.
 */
export function resolveFood(id: unknown, name: unknown): TacoFood | null {
  if (typeof name === "string" && name.trim()) {
    const exact = foodByName.get(normalize(name));
    if (exact) return exact;
  }
  const n = Number(id);
  if (Number.isInteger(n)) {
    const f = foodById.get(n);
    if (f) {
      // id existe: só aceita se o nome citado não contradiz o alimento
      if (typeof name !== "string" || !name.trim()) return f;
      const a = normalize(f.name);
      const b = normalize(name);
      if (a.includes(b) || b.includes(a)) return f;
    }
  }
  if (typeof name === "string" && name.trim()) {
    const hit = searchFoods(name, 1)[0];
    if (hit && hit.score >= 0.75) return hit.food;
  }
  return null;
}

/** Busca simples por palavras (sem acento, plural e singular). Devolve do melhor para o pior. */
export function searchFoods(query: string, limit = 5): Array<{ food: TacoFood; score: number }> {
  const stem = (w: string) => w.replace(/(es|s)$/, "");
  const q = normalize(query)
    .split(" ")
    .filter((w) => w.length > 1)
    .map(stem);
  if (q.length === 0) return [];
  const out: Array<{ food: TacoFood; score: number }> = [];
  for (const food of TACO_FOODS) {
    const words = new Set(normalize(food.name).split(" ").map(stem));
    const hits = q.filter((w) => words.has(w)).length;
    if (hits === 0) continue;
    // cobertura da busca + leve preferência por nomes curtos (entradas mais genéricas)
    const score = hits / q.length - words.size * 0.004;
    out.push({ food, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export type Nutrients = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sodiumMg: number;
};

export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodiumMg: 0 };

/** Nutrientes de uma quantidade (em gramas) de um alimento. */
export function nutrientsFor(food: TacoFood, grams: number): Nutrients {
  const k = grams / 100;
  return {
    kcal: food.kcal * k,
    protein: food.protein * k,
    fat: food.fat * k,
    carbs: food.carbs * k,
    fiber: (food.fiber ?? 0) * k,
    sodiumMg: (food.sodiumMg ?? 0) * k,
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      fat: acc.fat + n.fat,
      carbs: acc.carbs + n.carbs,
      fiber: acc.fiber + n.fiber,
      sodiumMg: acc.sodiumMg + n.sodiumMg,
    }),
    ZERO,
  );
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    fat: n.fat * factor,
    carbs: n.carbs * factor,
    fiber: n.fiber * factor,
    sodiumMg: n.sodiumMg * factor,
  };
}

/**
 * Lista de alimentos para colocar no prompt da IA: "id nome", um por linha.
 * Só os alimentos que servem de ingrediente ou refeição (sem bebidas alcoólicas).
 */
export function promptFoodList(): string {
  return TACO_FOODS.filter((f) => !/^Cana, aguardente|^Cerveja|^Vinho|^Whisky/i.test(f.name))
    .map((f) => `${f.id} ${f.name}`)
    .join("\n");
}
