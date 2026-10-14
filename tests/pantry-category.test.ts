import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, isValidCategory, suggestCategory } from "../src/lib/pantry-category.ts";

const casos: Array<[string, string]> = [
  ["tomate", "Legumes"],
  ["tomates", "Legumes"],
  ["cenouras", "Legumes"],
  ["tomatinho", "Legumes"],
  ["Ovos", "Ovos"],
  ["limões", "Frutas"],
  ["maçã fuji", "Frutas"],
  ["pães", "Pães"],
  ["pão de queijo", "Pães"],
  ["feijões pretos", "Grãos"],
  ["arroz", "Cereais"],
  ["Filé de Salmão", "Peixes e Frutos do Mar"],
  ["óleo de coco", "Óleos"],
  ["peito de frango", "Carnes"],
  ["requeijão cremoso", "Laticínios"],
  ["Coca-Cola", "Bebidas"],
  ["água de coco", "Bebidas"],
  ["leite de aveia", "Bebidas"],
  ["molho shoyu", "Molhos e Condimentos"],
  ["castanha do pará", "Snacks"],
  ["tofu", "Proteínas"],
  ["caldo de galinha", "Temperos"],
  ["ketchup", "Molhos e Condimentos"],
];

for (const [nome, esperado] of casos) {
  test(`"${nome}" -> ${esperado}`, () => {
    assert.equal(suggestCategory(nome), esperado);
  });
}

test('"sal" não casa dentro de "salsicha"', () => {
  assert.equal(suggestCategory("salsicha"), "Carnes");
  assert.equal(suggestCategory("sal"), "Temperos");
});

test("palavra mais específica vence (salmão > filé, óleo de coco > coco)", () => {
  assert.equal(suggestCategory("filé de salmão"), "Peixes e Frutos do Mar");
  assert.equal(suggestCategory("óleo de coco"), "Óleos");
});

test("nome desconhecido ou vazio devolve null (vai para a IA)", () => {
  assert.equal(suggestCategory("xyzabc"), null);
  assert.equal(suggestCategory("   "), null);
});

test("toda categoria sugerida existe na lista oficial", () => {
  for (const [nome] of casos) {
    const c = suggestCategory(nome);
    assert.ok(c && isValidCategory(c), nome);
  }
  assert.ok(isValidCategory("Outros"));
  assert.ok(!isValidCategory("Inventada"));
  assert.equal(CATEGORIES.length, new Set(CATEGORIES).size);
});
