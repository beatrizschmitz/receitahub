import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TACO_FOODS,
  getFood,
  nutrientsFor,
  promptFoodList,
  resolveFood,
  searchFoods,
  sumNutrients,
} from "../src/lib/taco.ts";
import { toGrams } from "../src/lib/measures.ts";

test("a tabela tem os alimentos esperados e ids únicos", () => {
  assert.ok(TACO_FOODS.length >= 590);
  assert.equal(new Set(TACO_FOODS.map((f) => f.id)).size, TACO_FOODS.length);
});

test("valores conhecidos da TACO (por 100 g)", () => {
  const arroz = getFood(1);
  assert.equal(arroz?.name, "Arroz, integral, cozido");
  assert.ok(Math.abs((arroz?.kcal ?? 0) - 123.5) < 0.1);
  const feijao = TACO_FOODS.find((f) => f.name === "Feijão, carioca, cozido");
  assert.ok(Math.abs((feijao?.kcal ?? 0) - 76.4) < 0.2);
  assert.ok(Math.abs((feijao?.protein ?? 0) - 4.78) < 0.05);
});

test("nutrientes por quantidade: 200 g de arroz integral cozido", () => {
  const n = nutrientsFor(getFood(1)!, 200);
  assert.ok(Math.abs(n.kcal - 247) < 1);
  assert.ok(Math.abs(n.carbs - 51.6) < 0.2);
});

test("soma de nutrientes", () => {
  const a = nutrientsFor(getFood(1)!, 100);
  const s = sumNutrients([a, a]);
  assert.ok(Math.abs(s.kcal - a.kcal * 2) < 1e-9);
});

test("leite líquido é derivado do pó da própria TACO (13%)", () => {
  const leite = getFood(458);
  assert.equal(leite?.name, "Leite, de vaca, integral");
  assert.ok(leite?.derivedFrom?.includes("459"));
  // leite integral real: ~61 kcal/100 mL; derivado: ~65
  assert.ok((leite?.kcal ?? 0) > 58 && (leite?.kcal ?? 0) < 70);
  const desnatado = getFood(457);
  assert.ok((desnatado?.kcal ?? 0) > 30 && (desnatado?.kcal ?? 0) < 42);
});

test("resolveFood: nome exato vence id errado; id sem nome vale; nome inexistente cai em busca", () => {
  assert.equal(resolveFood(999, "Arroz, integral, cozido")?.id, 1);
  assert.equal(resolveFood(1, null)?.id, 1);
  assert.equal(resolveFood(1, "Arroz, integral, cozido")?.id, 1);
  assert.equal(resolveFood(99999, "nada a ver xyz"), null);
});

test("searchFoods ignora acento e plural", () => {
  const r = searchFoods("feijões carioca cozido", 3);
  assert.ok(r[0].food.name.toLowerCase().includes("feijão, carioca, cozido"));
});

test("lista de alimentos para o prompt traz id e nome", () => {
  const list = promptFoodList();
  assert.ok(list.includes("1 Arroz, integral, cozido"));
  assert.ok(!/Cerveja/.test(list));
});

test("medidas caseiras: colher de sopa de azeite ~ 14 g; xícara de farinha ~ 120 g", () => {
  const azeite = toGrams(1, "colher de sopa", "azeite");
  assert.ok(azeite && Math.abs(azeite.grams - 13.8) < 0.5 && azeite.approx);
  const farinha = toGrams(1, "xícara", "farinha de trigo");
  assert.ok(farinha && Math.abs(farinha.grams - 120) < 1);
});

test("medidas: ovo médio 50 g, dente de alho 4 g, peso em gramas não é aproximado", () => {
  assert.equal(toGrams(2, "unidade", "ovo")?.grams, 100);
  assert.equal(toGrams(3, "dente", "alho")?.grams, 12);
  assert.deepEqual(toGrams(250, "g", "arroz"), { grams: 250, approx: false });
  assert.deepEqual(toGrams(0.5, "kg", "carne"), { grams: 500, approx: false });
  assert.equal(toGrams(1, "a gosto", "sal")?.grams, 0);
});

test("unidade sem peso conhecido ou quantidade inválida devolve null", () => {
  assert.equal(toGrams(1, "unidade", "xyzqwerty"), null);
  assert.equal(toGrams(-1, "g", "arroz"), null);
  assert.equal(toGrams(Number.NaN, "g", "arroz"), null);
});
