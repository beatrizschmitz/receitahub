import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDay, scaleMealToKcal } from "../src/lib/diet-taco.ts";
import { calculateTargets } from "../src/lib/nutrition.ts";
import { TACO_FOODS, nutrientsFor, sumNutrients, type TacoFood } from "../src/lib/taco.ts";

const find = (name: string): TacoFood => {
  const f = TACO_FOODS.find((x) => x.name === name);
  assert.ok(f, `alimento não encontrado: ${name}`);
  return f;
};
const item = (name: string, grams: number) => {
  const f = find(name);
  return { taco_id: f.id, taco_name: f.name, grams };
};

const t = calculateTargets(
  { sex: "feminino", age: 28, weightKg: 68, heightCm: 165, activity: "moderado" },
  "perder_peso",
);
const WEEK = ["Segunda", "Terça"] as const;

const day = {
  day: "Segunda",
  meals: [
    {
      meal: "Café da manhã",
      name: "Pão com ovo",
      items: [
        item("Pão, trigo, francês", 50),
        item("Ovo, de galinha, inteiro, cozido/10minutos", 100),
        item("Mamão, Papaia, cru", 150),
      ],
    },
    {
      meal: "Lanche da manhã",
      name: "Iogurte",
      items: [item("Iogurte, natural", 170), item("Banana, prata, crua", 60)],
    },
    {
      meal: "Almoço",
      name: "Prato",
      items: [
        item("Arroz, tipo 1, cozido", 150),
        item("Feijão, carioca, cozido", 120),
        item("Frango, peito, sem pele, grelhado", 120),
        item("Alface, crespa, crua", 40),
      ],
    },
    {
      meal: "Lanche da tarde",
      name: "Fruta",
      items: [item("Maçã, Fuji, com casca, crua", 130), item("Amendoim, grão, cru", 20)],
    },
    {
      meal: "Jantar",
      name: "Sopa",
      items: [
        item("Batata, inglesa, cozida", 150),
        item("Frango, peito, sem pele, grelhado", 110),
        item("Cenoura, cozida", 80),
      ],
    },
  ],
};

test("o ajuste fecha a meta de calorias do dia (±7%) e cada refeição chega perto da sua meta", () => {
  const d = buildDay(
    day,
    0,
    WEEK,
    t.meals.map((m) => ({ meal: m.meal, kcal: m.kcal })),
    t.kcal,
    t.proteinG,
  );
  assert.equal(d.meals.length, 5);
  assert.ok(Math.abs(d.totals.kcal - t.kcal) / t.kcal < 0.07, `${d.totals.kcal} vs ${t.kcal}`);
  d.meals.forEach((m, i) => {
    assert.ok(
      Math.abs(m.nutrients.kcal - t.meals[i].kcal) / t.meals[i].kcal < 0.12,
      `${m.meal}: ${m.nutrients.kcal} vs ${t.meals[i].kcal}`,
    );
  });
});

test("as gramas ficam em múltiplos de 5 e os nutrientes vêm da tabela", () => {
  const d = buildDay(
    day,
    0,
    WEEK,
    t.meals.map((m) => ({ meal: m.meal, kcal: m.kcal })),
    t.kcal,
    t.proteinG,
  );
  for (const m of d.meals) {
    for (const i of m.items) assert.equal(i.grams % 5, 0);
    const again = sumNutrients(m.items.map((i) => nutrientsFor(i.food, i.grams)));
    assert.ok(Math.abs(again.kcal - m.nutrients.kcal) < 1e-6);
  }
});

test("alimento inventado é recusado e vira ponto a corrigir", () => {
  const bad = structuredClone(day);
  bad.meals[2].items.push({ taco_id: 99999, taco_name: "Prato mágico inexistente", grams: 100 });
  const d = buildDay(
    bad,
    0,
    WEEK,
    t.meals.map((m) => ({ meal: m.meal, kcal: m.kcal })),
    t.kcal,
    t.proteinG,
  );
  assert.ok(d.issues.some((x) => x.includes("fora da tabela")));
  assert.ok(d.meals[2].items.every((i) => i.food.name !== "Prato mágico inexistente"));
});

test("refeição sem alimentos válidos é sinalizada", () => {
  const empty = { day: "Terça", meals: [{ meal: "Café da manhã", items: [] }] };
  const d = buildDay(
    empty,
    1,
    WEEK,
    t.meals.map((m) => ({ meal: m.meal, kcal: m.kcal })),
    t.kcal,
    t.proteinG,
  );
  assert.ok(d.issues.length >= 5);
  assert.ok(d.issues.some((x) => x.includes("sem alimentos válidos")));
});

test("escala limitada: uma refeição minúscula não vira porção absurda", () => {
  const tiny = [{ food: find("Arroz, tipo 1, cozido"), grams: 5 }];
  const scaled = scaleMealToKcal(tiny, 800);
  // fator máximo 2,2: 5 g -> ~10 g, nunca 600 g
  assert.ok(scaled[0].grams <= 15);
});
