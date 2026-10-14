// Monta os dias do plano alimentar a partir da escolha de alimentos da IA, com
// os nutrientes da TACO. A IA escolhe alimentos (da tabela) e as quantidades
// aproximadas; aqui as gramas de cada refeição são ajustadas para fechar a meta
// de calorias da refeição, e os macros são os da tabela.

import {
  nutrientsFor,
  resolveFood,
  scaleNutrients,
  sumNutrients,
  type Nutrients,
  type TacoFood,
} from "./taco.ts";

export type RawItem = { taco_id?: unknown; taco_name?: unknown; grams?: unknown };
export type RawMeal = { meal?: unknown; name?: unknown; description?: unknown; items?: unknown };
export type RawDay = { day?: unknown; meals?: unknown };

export type MealTargetInput = { meal: string; kcal: number };

export type BuiltItem = { food: TacoFood; grams: number };

export type BuiltMeal = {
  meal: string;
  name: string;
  description: string;
  items: BuiltItem[];
  nutrients: Nutrients;
};

export type BuiltDay = {
  day: string;
  meals: BuiltMeal[];
  totals: Nutrients;
  /** Pontos que fogem do esperado; voltam para a IA corrigir */
  issues: string[];
};

const MIN_GRAMS = 5;
const MAX_ITEM_GRAMS = 800;
/** Quanto uma refeição pode ser escalada para fechar a meta, sem virar uma porção absurda */
const SCALE_MIN = 0.45;
const SCALE_MAX = 2.2;

const round5 = (g: number) => Math.max(MIN_GRAMS, Math.round(g / 5) * 5);

function asText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function readItems(rawItems: unknown): { items: BuiltItem[]; unknown: string[] } {
  const items: BuiltItem[] = [];
  const unknown: string[] = [];
  for (const it of Array.isArray(rawItems) ? (rawItems as RawItem[]) : []) {
    const food = resolveFood(it?.taco_id, it?.taco_name);
    const grams = Number(it?.grams);
    if (!food) {
      unknown.push(asText(it?.taco_name, 60) || String(it?.taco_id ?? "?"));
      continue;
    }
    if (!Number.isFinite(grams) || grams <= 0) continue;
    items.push({ food, grams: Math.min(grams, MAX_ITEM_GRAMS) });
  }
  return { items, unknown };
}

function mealNutrients(items: BuiltItem[]): Nutrients {
  return sumNutrients(items.map((i) => nutrientsFor(i.food, i.grams)));
}

/** Multiplica as gramas de uma refeição para ela chegar perto das calorias-alvo. */
export function scaleMealToKcal(items: BuiltItem[], targetKcal: number): BuiltItem[] {
  const raw = mealNutrients(items).kcal;
  if (raw <= 0 || targetKcal <= 0) return items;
  const factor = Math.min(Math.max(targetKcal / raw, SCALE_MIN), SCALE_MAX);
  return items.map((i) => ({ food: i.food, grams: round5(i.grams * factor) }));
}

export function buildDay(
  raw: RawDay,
  index: number,
  weekdays: readonly string[],
  mealTargets: readonly MealTargetInput[],
  dayKcalTarget: number,
  proteinTargetG: number,
): BuiltDay {
  const dayName = asText(raw?.day, 20) || weekdays[index] || `Dia ${index + 1}`;
  const issues: string[] = [];
  const rawMeals = Array.isArray(raw?.meals) ? (raw.meals as RawMeal[]) : [];

  const meals: BuiltMeal[] = mealTargets.map((target, m) => {
    const rm = rawMeals[m] ?? {};
    const { items, unknown } = readItems(rm.items);
    if (unknown.length > 0) {
      issues.push(`${dayName}, ${target.meal}: alimentos fora da tabela (${unknown.join(", ")})`);
    }
    if (items.length === 0) {
      issues.push(`${dayName}, ${target.meal}: sem alimentos válidos da tabela`);
      return {
        meal: target.meal,
        name: asText(rm.name, 120) || target.meal,
        description: asText(rm.description, 300),
        items: [],
        nutrients: sumNutrients([]),
      };
    }
    const rawKcal = mealNutrients(items).kcal;
    const ratio = target.kcal > 0 ? rawKcal / target.kcal : 1;
    if (ratio < SCALE_MIN || ratio > SCALE_MAX) {
      issues.push(
        `${dayName}, ${target.meal}: porções muito longe da meta (${Math.round(rawKcal)} kcal para ${Math.round(target.kcal)} kcal)`,
      );
    }
    const scaled = scaleMealToKcal(items, target.kcal);
    return {
      meal: target.meal,
      name: asText(rm.name, 120) || target.meal,
      description: asText(rm.description, 300),
      items: scaled,
      nutrients: mealNutrients(scaled),
    };
  });

  const totals = sumNutrients(meals.map((m) => m.nutrients));
  if (dayKcalTarget > 0 && Math.abs(totals.kcal - dayKcalTarget) / dayKcalTarget > 0.07) {
    issues.push(
      `${dayName}: ${Math.round(totals.kcal)} kcal no dia (meta ${Math.round(dayKcalTarget)} kcal)`,
    );
  }
  if (proteinTargetG > 0 && totals.protein > 0) {
    const share = totals.protein / proteinTargetG;
    if (share < 0.7 || share > 1.5) {
      issues.push(
        `${dayName}: ${Math.round(totals.protein)} g de proteína (meta ${Math.round(proteinTargetG)} g)`,
      );
    }
  }
  return { day: dayName, meals, totals, issues };
}

export { scaleNutrients };
