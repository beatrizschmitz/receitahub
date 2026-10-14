// Rodar com: npm test  (executor nativo do Node, sem dependências)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTargets,
  detectGoal,
  kcalFromMacros,
  validateBody,
  MEAL_SPLIT,
  type BodyData,
} from "../src/lib/nutrition.ts";

const mulher: BodyData = {
  sex: "feminino",
  age: 28,
  weightKg: 68,
  heightCm: 165,
  activity: "moderado",
};

test("Mifflin-St Jeor: mulher de 28 anos, 68 kg, 165 cm", () => {
  // 10*68 + 6,25*165 - 5*28 - 161 = 1410,25
  const t = calculateTargets(mulher, "manter_peso");
  assert.equal(t.bmr, 1410);
  // x 1,55 (moderado) = 2185,9
  assert.equal(t.tdee, 2186);
  assert.equal(t.kcal, 2190);
  assert.equal(t.adjustmentKcal, 0);
});

test("homem usa +5 na equação do gasto basal", () => {
  const t = calculateTargets({ ...mulher, sex: "masculino" }, "manter_peso");
  assert.equal(t.bmr, 1410 + 166);
});

test("emagrecer aplica déficit de ~20%", () => {
  const t = calculateTargets(mulher, "perder_peso");
  assert.ok(t.kcal < t.tdee);
  assert.ok(Math.abs(t.kcal / t.tdee - 0.8) < 0.02);
});

test("ganhar massa soma superávit de no máximo 500 kcal", () => {
  const t = calculateTargets({ ...mulher, weightKg: 90, activity: "intenso" }, "ganhar_massa");
  assert.ok(t.adjustmentKcal > 0 && t.adjustmentKcal <= 500);
});

test("os macros fecham com a meta de calorias (±2%)", () => {
  for (const goal of [
    "perder_peso",
    "ganhar_massa",
    "manter_peso",
    "saudavel",
    "colesterol",
  ] as const) {
    const t = calculateTargets(mulher, goal);
    const fromMacros = kcalFromMacros(t.proteinG, t.carbsG, t.fatG);
    assert.ok(Math.abs(fromMacros - t.kcal) / t.kcal < 0.02, `${goal}: ${fromMacros} vs ${t.kcal}`);
  }
});

test("as refeições somam a meta do dia e a divisão soma 100%", () => {
  const share = MEAL_SPLIT.reduce((s, m) => s + m.share, 0);
  assert.ok(Math.abs(share - 1) < 1e-9);
  const t = calculateTargets(mulher, "perder_peso");
  const soma = t.meals.reduce((s, m) => s + m.kcal, 0);
  assert.ok(Math.abs(soma - t.kcal) <= 15);
});

test("segurança: IMC abaixo de 18,5 não recebe déficit", () => {
  const t = calculateTargets(
    { sex: "feminino", age: 25, weightKg: 45, heightCm: 170, activity: "leve" },
    "perder_peso",
  );
  assert.equal(t.adjustmentKcal, 0);
  assert.ok(t.warnings.length > 0);
});

test("segurança: gestante/lactante nunca recebe déficit", () => {
  const t = calculateTargets({ ...mulher, pregnantOrLactating: true }, "perder_peso");
  assert.equal(t.adjustmentKcal, 0);
  assert.ok(t.warnings.length >= 1);
});

test("segurança: a meta nunca fica abaixo do gasto basal", () => {
  const t = calculateTargets(
    { sex: "masculino", age: 40, weightKg: 130, heightCm: 175, activity: "sedentario" },
    "perder_peso",
  );
  assert.ok(t.kcal >= t.bmr - 10);
});

test("carboidrato nunca abaixo de 100 g/dia", () => {
  const t = calculateTargets(
    { sex: "feminino", age: 50, weightKg: 50, heightCm: 155, activity: "sedentario" },
    "perder_peso",
  );
  assert.ok(t.carbsG >= 100);
});

test("validação: menores de 18, medidas absurdas e campos ausentes", () => {
  assert.equal(validateBody({ ...mulher, age: 16 }).ok, false);
  assert.equal(validateBody({ ...mulher, weightKg: 500 }).ok, false);
  assert.equal(validateBody({ ...mulher, heightCm: 80 }).ok, false);
  assert.equal(validateBody({ ...mulher, sex: undefined }).ok, false);
  assert.equal(validateBody({ ...mulher, activity: undefined }).ok, false);
  assert.equal(validateBody({ ...mulher, age: Number.NaN }).ok, false);
  assert.equal(validateBody(mulher).ok, true);
});

test("detectGoal entende os chips e texto livre", () => {
  assert.equal(detectGoal("perder peso"), "perder_peso");
  assert.equal(detectGoal("quero emagrecer"), "perder_peso");
  assert.equal(detectGoal("ganhar massa muscular"), "ganhar_massa");
  assert.equal(detectGoal("reduzir o colesterol"), "colesterol");
  assert.equal(detectGoal("manter o peso"), "manter_peso");
  assert.equal(detectGoal("comer mais saudável"), "saudavel");
});
