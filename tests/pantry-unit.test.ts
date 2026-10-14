import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayQuantity,
  formatQuantity,
  isUnit,
  parseQuantity,
  suggestUnit,
} from "../src/lib/pantry-unit.ts";

const casos: Array<[string, string | null, string]> = [
  ["arroz", "Cereais", "kg"],
  ["feijões", "Grãos", "kg"],
  ["leite", "Laticínios", "L"],
  ["ovos", "Ovos", "un"],
  ["tomates", "Legumes", "kg"],
  ["azeite", "Óleos", "mL"],
  ["queijo mussarela", "Laticínios", "g"],
  ["salsinha", null, "maço"],
  ["salsa", "Ervas", "maço"],
  ["macarrão", "Massas", "pacote"],
  ["atum", "Enlatados", "lata"],
  ["leite condensado", "Laticínios", "lata"],
  ["iogurte", "Laticínios", "pote"],
  ["vinho tinto", "Bebidas", "garrafa"],
  ["creme de leite", "Laticínios", "caixa"],
  ["manjericão", "Ervas", "maço"],
  ["pão francês", "Pães", "un"],
  // sem regra própria: cai no padrão da categoria
  ["quinoa", "Cereais", "kg"],
  ["xyzabc", "Outros", "un"],
];

for (const [nome, categoria, esperado] of casos) {
  test(`${nome} (${categoria ?? "sem categoria"}) -> ${esperado}`, () => {
    assert.equal(suggestUnit(nome, categoria), esperado);
  });
}

test("toda unidade sugerida é válida", () => {
  for (const [nome, categoria] of casos) assert.ok(isUnit(suggestUnit(nome, categoria)));
});

test("quantidade: aceita vírgula e ponto, recusa zero, negativo e texto", () => {
  assert.equal(parseQuantity("1,5"), 1.5);
  assert.equal(parseQuantity("2"), 2);
  assert.equal(parseQuantity("0"), null);
  assert.equal(parseQuantity("-1"), null);
  assert.equal(parseQuantity("abc"), null);
  assert.equal(parseQuantity(""), null);
});

test("formatação guardada e exibição de itens antigos", () => {
  assert.equal(formatQuantity(1.5, "kg"), "1,5 kg");
  assert.equal(formatQuantity(4, "un"), "4 un");
  assert.equal(displayQuantity("1kg"), "1 kg");
  assert.equal(displayQuantity("2 pacotes"), "2 pacotes");
  assert.equal(displayQuantity("um punhado"), "um punhado");
  assert.equal(displayQuantity(null), "—");
});
