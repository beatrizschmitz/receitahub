import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveIngredient, summarizeRecipe } from "../src/lib/recipe-taco.ts";

test("receita simples: contas conferidas à mão", () => {
  // 1 xícara de arroz cru (240 mL x 0,8 = 192 g), 200 g de feijão cozido, 1 colher de sopa de azeite
  const items = [
    resolveIngredient({
      ingredient: "1 xícara de arroz",
      taco_name: "Arroz, tipo 1, cru",
      amount: 1,
      unit: "xícara",
    }),
    resolveIngredient({
      ingredient: "200 g de feijão cozido",
      taco_name: "Feijão, carioca, cozido",
      amount: 200,
      unit: "g",
    }),
    resolveIngredient({
      ingredient: "1 colher de sopa de azeite",
      taco_name: "Azeite, de oliva, extra virgem",
      amount: 1,
      unit: "colher de sopa",
    }),
    resolveIngredient({
      ingredient: "sal a gosto",
      taco_name: "Sal, grosso",
      amount: 1,
      unit: "a gosto",
      negligible: true,
    }),
  ];
  const r = summarizeRecipe(items, 2);
  assert.ok(r);
  // arroz: 192 g x 3,578 kcal/g = ~687; feijão: 200 g x 0,764 = ~153; azeite: 13,8 g x 8,84 = ~122; total ~962 / 2 = ~481
  assert.ok(Math.abs(r.nutrition.calories - 481) <= 6, String(r.nutrition.calories));
  assert.equal(r.nutrition.source, "taco");
  assert.equal(r.nutrition.approx, true); // usou xícara e colher
  assert.equal(r.matched, 3);
  assert.equal(r.counted, 3);
});

test("só medidas em gramas não são aproximadas", () => {
  const items = [
    resolveIngredient({
      ingredient: "300 g de peito de frango",
      taco_name: "Frango, peito, sem pele, grelhado",
      amount: 300,
      unit: "g",
    }),
    resolveIngredient({
      ingredient: "100 g de arroz",
      taco_name: "Arroz, tipo 1, cozido",
      amount: 100,
      unit: "g",
    }),
  ];
  const r = summarizeRecipe(items, 1);
  assert.ok(r);
  assert.equal(r.nutrition.approx, false);
  assert.deepEqual(r.nutrition.unmatched, []);
});

test("cobertura baixa da tabela devolve null (cai na estimativa da IA)", () => {
  const items = [
    resolveIngredient({
      ingredient: "1 prato exótico",
      taco_id: null,
      taco_name: "Inexistente xyz",
      amount: 1,
      unit: "unidade",
    }),
    resolveIngredient({
      ingredient: "outro item raro",
      taco_id: null,
      taco_name: "Também inexistente",
      amount: 100,
      unit: "g",
    }),
    resolveIngredient({
      ingredient: "100 g de arroz",
      taco_name: "Arroz, tipo 1, cozido",
      amount: 100,
      unit: "g",
    }),
  ];
  assert.equal(summarizeRecipe(items, 1), null);
});

test("ingrediente sem correspondente fica listado, e a conta segue", () => {
  const items = [
    resolveIngredient({
      ingredient: "200 g de arroz",
      taco_name: "Arroz, tipo 1, cozido",
      amount: 200,
      unit: "g",
    }),
    resolveIngredient({
      ingredient: "150 g de feijão",
      taco_name: "Feijão, carioca, cozido",
      amount: 150,
      unit: "g",
    }),
    resolveIngredient({
      ingredient: "100 g de bife",
      taco_name: "Carne, bovina, acém, moído, cozido",
      amount: 100,
      unit: "g",
    }),
    resolveIngredient({
      ingredient: "erva rara",
      taco_id: null,
      taco_name: "Inexistente",
      amount: 10,
      unit: "g",
    }),
  ];
  const r = summarizeRecipe(items, 1);
  assert.ok(r);
  assert.deepEqual(r.nutrition.unmatched, ["erva rara"]);
});

test("receita sem ingredientes relevantes ou com porções inválidas devolve null", () => {
  assert.equal(summarizeRecipe([], 2), null);
  assert.equal(
    summarizeRecipe(
      [resolveIngredient({ ingredient: "sal", negligible: true, amount: 1, unit: "a gosto" })],
      2,
    ),
    null,
  );
});
