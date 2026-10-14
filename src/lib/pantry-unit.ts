// Unidade de medida sugerida para um item da despensa, a partir do nome (igual
// à categoria): primeiro uma regra específica do alimento, depois o padrão da
// categoria. É só uma sugestão, sempre editável.

import { keywordHits, nameForms, normalizeItemName } from "./pantry-category.ts";

export const UNITS = [
  "un",
  "kg",
  "g",
  "L",
  "mL",
  "dúzia",
  "maço",
  "pacote",
  "lata",
  "caixa",
  "garrafa",
  "pote",
  "saco",
] as const;

export type Unit = (typeof UNITS)[number];

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

/** Padrão por categoria, quando o alimento não tem regra própria. */
const CATEGORY_UNIT: Record<string, Unit> = {
  Grãos: "kg",
  Cereais: "kg",
  Massas: "pacote",
  Frutas: "kg",
  Vegetais: "kg",
  Legumes: "kg",
  Verduras: "maço",
  Proteínas: "g",
  Carnes: "kg",
  "Peixes e Frutos do Mar": "kg",
  Laticínios: "g",
  Ovos: "un",
  Pães: "un",
  Ervas: "maço",
  Temperos: "g",
  Óleos: "mL",
  "Molhos e Condimentos": "pote",
  Enlatados: "lata",
  Congelados: "pacote",
  "Doces e Açúcares": "g",
  Bebidas: "L",
  Snacks: "pacote",
  Outros: "un",
};

// Regras específicas (palavra-chave sem acento e no singular). Vence a mais longa.
const UNIT_KEYWORDS: Array<[string[], Unit]> = [
  [
    [
      "ovo",
      "abacate",
      "melancia",
      "melao",
      "mamao",
      "manga",
      "abacaxi",
      "coco",
      "alface",
      "repolho",
      "couve flor",
      "couve-flor",
      "brocolis",
      "pao",
      "pao frances",
      "pao de queijo",
      "chocolate",
      "barra de chocolate",
      "bolo",
      "pizza",
      "limao",
      "pepino",
      "abobrinha",
      "berinjela",
      "pimentao",
      "alho",
      "cabeca de alho",
    ],
    "un",
  ],
  [
    ["leite", "suco", "agua", "refrigerante", "agua de coco", "leite de coco", "iogurte liquido"],
    "L",
  ],
  [
    [
      "azeite",
      "oleo",
      "vinagre",
      "shoyu",
      "molho shoyu",
      "molho ingles",
      "essencia",
      "molho de pimenta",
      "tabasco",
    ],
    "mL",
  ],
  [
    ["vinho", "cerveja", "cachaca", "vodka", "whisky", "espumante", "champanhe", "licor"],
    "garrafa",
  ],
  [
    [
      "queijo",
      "mussarela",
      "parmesao",
      "ricota",
      "presunto",
      "peito de peru",
      "bacon",
      "manteiga",
      "margarina",
      "salame",
      "mortadela",
      "castanha",
      "nozes",
      "amendoa",
      "amendoim",
      "canela",
      "oregano",
      "pimenta do reino",
      "paprica",
      "curcuma",
      "cominho",
      "colorau",
      "fermento",
      "bicarbonato",
      "cacau",
      "whey",
      "tofu",
      "uva passa",
      "gelatina",
    ],
    "g",
  ],
  [
    [
      "iogurte",
      "requeijao",
      "cream cheese",
      "mel",
      "geleia",
      "maionese",
      "ketchup",
      "mostarda",
      "doce de leite",
      "pasta de amendoim",
      "nutella",
      "tahine",
      "azeitona",
      "picles",
      "pesto",
      "homus",
    ],
    "pote",
  ],
  [
    [
      "manjericao",
      "salsa",
      "cebolinha",
      "coentro",
      "hortela",
      "alecrim",
      "tomilho",
      "couve",
      "espinafre",
      "rucula",
      "agriao",
      "acelga",
      "cheiro verde",
      "louro",
      "folha de louro",
      "erva",
    ],
    "maço",
  ],
  [
    [
      "atum",
      "sardinha",
      "milho em lata",
      "ervilha em lata",
      "leite condensado",
      "extrato de tomate",
      "molho de tomate",
      "palmito",
      "seleta",
      "lata",
    ],
    "lata",
  ],
  [["creme de leite", "caldo", "cha", "gelatina em po", "maisena"], "caixa"],
  [
    [
      "macarrao",
      "espaguete",
      "lasanha",
      "penne",
      "parafuso",
      "talharim",
      "miojo",
      "lamen",
      "biscoito",
      "bolacha",
      "salgadinho",
      "pipoca",
      "granola",
      "aveia",
      "cafe",
      "torrada",
      "salsicha",
      "hamburguer",
      "nuggets",
      "empanado",
      "pao de forma",
      "tortilha",
      "wrap",
      "sorvete",
    ],
    "pacote",
  ],
  [["ovo de codorna"], "un"],
  [["sal", "sal grosso"], "kg"],
  [["banana", "banana prata", "banana nanica"], "kg"],
  [["tomate", "cebola", "cenoura", "batata", "mandioca", "abobora", "beterraba", "chuchu"], "kg"],
  [
    [
      "arroz",
      "feijao",
      "lentilha",
      "grao de bico",
      "acucar",
      "farinha",
      "farinha de trigo",
      "fuba",
      "polvilho",
    ],
    "kg",
  ],
  [
    [
      "frango",
      "carne moida",
      "carne bovina",
      "acem",
      "patinho",
      "alcatra",
      "picanha",
      "costela",
      "linguica",
      "peixe",
      "salmao",
      "tilapia",
      "camarao",
      "file",
    ],
    "kg",
  ],
];

const UNIT_INDEX: Array<{ keyword: string; unit: Unit }> = [];
for (const [keywords, unit] of UNIT_KEYWORDS) {
  for (const raw of keywords) {
    const keyword = normalizeItemName(raw);
    if (keyword) UNIT_INDEX.push({ keyword, unit });
  }
}

/** Unidade sugerida para o item. `category` é a categoria já definida (para o padrão). */
export function suggestUnit(name: string, category?: string | null): Unit {
  const forms = nameForms(name);
  if (forms) {
    let best: { unit: Unit; length: number } | null = null;
    for (const { keyword, unit } of UNIT_INDEX) {
      if (keywordHits(forms, keyword) && (!best || keyword.length > best.length)) {
        best = { unit, length: keyword.length };
      }
    }
    if (best) return best.unit;
  }
  return (category && CATEGORY_UNIT[category]) || "un";
}

/** "1,5" ou "1.5" -> 1.5; vazio, zero, negativo ou texto -> null. */
export function parseQuantity(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

/** Texto guardado na despensa: "1,5 kg". */
export function formatQuantity(amount: number, unit: Unit): string {
  const num = amount.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return `${num} ${unit}`;
}

/** Para exibir também os itens antigos: "1kg" -> "1 kg"; textos livres ficam como estão. */
export function displayQuantity(stored: string | null): string {
  if (!stored) return "—";
  const m = stored.trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ]+)$/);
  return m ? `${m[1]} ${m[2]}` : stored.trim();
}
