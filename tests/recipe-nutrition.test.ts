import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caloriesFromMacros,
  nutritionFromMacros,
  parseNutrition,
} from "../src/lib/recipe-nutrition.ts";

test("calorias vêm dos macros (4/4/9)", () => {
  assert.equal(caloriesFromMacros(12, 70, 17), 481);
  assert.equal(nutritionFromMacros(12, 70, 17)?.calories, 481);
});

test("parseNutrition aceita número em texto e arredonda", () => {
  assert.deepEqual(parseNutrition({ calories: "480.4", protein: 12.2, carbs: "70", fat: 17 }), {
    calories: 480,
    protein: 12,
    carbs: 70,
    fat: 17,
  });
});

test("parseNutrition recusa dados incompletos, negativos ou sem calorias", () => {
  assert.equal(parseNutrition(null), null);
  assert.equal(parseNutrition("x"), null);
  assert.equal(parseNutrition({ calories: 300, protein: 10 }), null);
  assert.equal(parseNutrition({ calories: 0, protein: 1, carbs: 1, fat: 1 }), null);
  assert.equal(parseNutrition({ calories: 300, protein: -5, carbs: 1, fat: 1 }), null);
  assert.equal(nutritionFromMacros(Number.NaN, 10, 5), null);
});
