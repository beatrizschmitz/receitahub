// Conversão de medidas caseiras em gramas. A TACO traz valores por 100 g e não
// tem medidas caseiras, então este é o único ponto aproximado do cálculo: os
// números abaixo são equivalências usuais de receita brasileira, não dados da
// TACO. Qualquer resultado vindo de medida caseira sai marcado como aproximado.

export const MEASURE_UNITS = [
  "g",
  "kg",
  "mL",
  "L",
  "colher de sopa",
  "colher de chá",
  "xícara",
  "copo",
  "unidade",
  "dente",
  "fatia",
  "maço",
  "lata",
  "cubo",
  "pitada",
  "a gosto",
] as const;

export type MeasureUnit = (typeof MEASURE_UNITS)[number];
export type Size = "pequena" | "média" | "grande";

export function isMeasureUnit(value: unknown): value is MeasureUnit {
  return typeof value === "string" && (MEASURE_UNITS as readonly string[]).includes(value);
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Volume de cada medida, em mL
const VOLUME_ML: Partial<Record<MeasureUnit, number>> = {
  "colher de sopa": 15,
  "colher de chá": 5,
  xícara: 240,
  copo: 200,
};

// Densidade (g por mL) por tipo de alimento. Vence a primeira regra que bater.
const DENSITY: Array<[RegExp, number]> = [
  [/\b(oleo|azeite|gordura de coco)\b/, 0.92],
  [/\bmel\b|melado/, 1.4],
  [/\bsal\b/, 1.2],
  [/acucar de confeiteiro|acucar impalpavel/, 0.55],
  [/\bacucar\b/, 0.85],
  [/farinha de trigo|farinha de arroz|polvilho|amido|maisena/, 0.5],
  [/farinha de rosca|farinha de mandioca|fuba|farofa/, 0.5],
  [/aveia/, 0.4],
  [/\barroz\b/, 0.8],
  [/feijao|lentilha|grao de bico/, 0.8],
  [/leite em po|achocolatado|chocolate em po|cacau/, 0.5],
  [/queijo ralado|parmesao ralado|coco ralado/, 0.4],
  [/manteiga|margarina/, 0.96],
  [/maionese|requeijao|creme de leite|iogurte|cream cheese/, 1.0],
  [/shoyu|molho/, 1.1],
  [/castanha|amendoa|nozes|amendoim/, 0.55],
  [/\b(leite|agua|suco|caldo|vinho|vinagre|cafe|cha)\b/, 1.0],
];
const DEFAULT_DENSITY = 0.8;

// Peso de uma unidade (parte comestível), em gramas: [regra, pequena, média, grande]
const UNIT_WEIGHT: Array<[RegExp, number, number, number]> = [
  [/\bclara/, 25, 33, 40],
  [/\bgema/, 14, 17, 20],
  [/\bovo/, 40, 50, 60],
  [/cebola/, 70, 110, 160],
  [/tomate cereja|tomate-cereja/, 10, 15, 20],
  [/tomate/, 80, 120, 180],
  [/batata doce|batata-doce/, 100, 180, 280],
  [/batata/, 100, 150, 220],
  [/cenoura/, 50, 80, 120],
  [/abobrinha/, 150, 200, 300],
  [/berinjela/, 200, 300, 450],
  [/pepino/, 150, 200, 300],
  [/pimentao/, 90, 130, 180],
  [/limao/, 45, 65, 90],
  [/laranja/, 100, 150, 220],
  [/banana/, 60, 80, 100],
  [/\bmaca\b/, 100, 130, 180],
  [/\bpera\b/, 110, 140, 200],
  [/abacate/, 200, 300, 450],
  [/\bmanga\b/, 200, 300, 450],
  [/mamao/, 250, 400, 600],
  [/pao frances|paozinho|pao de sal/, 40, 50, 60],
  [/pao de forma/, 20, 25, 30],
  [/pao/, 40, 50, 70],
  [/linguica/, 60, 90, 130],
  [/salsicha/, 35, 50, 70],
  [/peito de frango/, 120, 180, 250],
  [/coxa|sobrecoxa/, 80, 110, 150],
  [/bife|file/, 100, 150, 200],
  [/biscoito|bolacha/, 5, 8, 12],
  [/folha de louro|louro/, 0.3, 0.5, 0.8],
];

// Uma fatia, em gramas
const SLICE_WEIGHT: Array<[RegExp, number]> = [
  [/pao de forma/, 25],
  [/pao/, 30],
  [/queijo|mussarela|mucarela|prato/, 20],
  [/presunto|peito de peru|apresuntado/, 15],
  [/bacon/, 12],
  [/bolo/, 60],
  [/abacaxi|melancia|melao|mamao/, 100],
  [/tomate/, 20],
  [/cebola/, 15],
];

// Outros pesos fixos, em gramas
const FIXED: Partial<Record<MeasureUnit, number>> = {
  dente: 4, // dente de alho
  maço: 50, // cheiro-verde, coentro, hortelã
  lata: 120, // atum, sardinha, milho e ervilha (peso drenado)
  cubo: 10, // caldo em cubo
  pitada: 0.5,
};

export type Grams = { grams: number; approx: boolean };

/**
 * Converte "2 colheres de sopa de azeite" (amount=2, unit="colher de sopa",
 * food="azeite") em gramas. Devolve null quando não há como converter.
 * `approx` é verdadeiro sempre que foi usada uma medida caseira.
 */
export function toGrams(
  amount: number,
  unit: MeasureUnit,
  food: string,
  size: Size = "média",
): Grams | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const f = norm(food);

  switch (unit) {
    case "g":
      return { grams: amount, approx: false };
    case "kg":
      return { grams: amount * 1000, approx: false };
    case "mL":
      return { grams: amount * densityOf(f), approx: densityOf(f) !== 1 };
    case "L":
      return { grams: amount * 1000 * densityOf(f), approx: densityOf(f) !== 1 };
    case "colher de sopa":
    case "colher de chá":
    case "xícara":
    case "copo":
      return { grams: amount * (VOLUME_ML[unit] as number) * densityOf(f), approx: true };
    case "a gosto":
      return { grams: 0, approx: false };
    case "fatia": {
      const w = SLICE_WEIGHT.find(([re]) => re.test(f))?.[1] ?? 25;
      return { grams: amount * w, approx: true };
    }
    case "unidade": {
      const row = UNIT_WEIGHT.find(([re]) => re.test(f));
      if (!row) return null;
      const w = size === "pequena" ? row[1] : size === "grande" ? row[3] : row[2];
      return { grams: amount * w, approx: true };
    }
    default: {
      const w = FIXED[unit];
      return w === undefined ? null : { grams: amount * w, approx: true };
    }
  }
}

function densityOf(foodNormalized: string): number {
  return DENSITY.find(([re]) => re.test(foodNormalized))?.[1] ?? DEFAULT_DENSITY;
}
