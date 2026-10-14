// Cálculo das necessidades nutricionais de uma pessoa. Funções puras, usadas
// tanto na tela (prévia ao vivo) quanto no servidor (que recalcula tudo e não
// confia nos números vindos do navegador).
//
// Método: gasto basal pela equação de Mifflin-St Jeor, multiplicado pelo fator
// de atividade (gasto energético total). O ajuste do objetivo e a divisão de
// macronutrientes seguem as faixas usuais de nutrição esportiva e clínica.
// É uma ESTIMATIVA — não substitui avaliação com nutricionista.

export type Sex = "feminino" | "masculino";
export type Activity = "sedentario" | "leve" | "moderado" | "intenso" | "muito_intenso";
export type Goal = "perder_peso" | "ganhar_massa" | "manter_peso" | "saudavel" | "colesterol";

export type BodyData = {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: Activity;
  /** Gestante ou lactante: nunca recebe déficit calórico. */
  pregnantOrLactating?: boolean;
};

export const ACTIVITY_OPTIONS: { key: Activity; label: string; hint: string; factor: number }[] = [
  { key: "sedentario", label: "Sedentário", hint: "pouco ou nenhum exercício", factor: 1.2 },
  { key: "leve", label: "Levemente ativo", hint: "exercício 1 a 3 dias por semana", factor: 1.375 },
  {
    key: "moderado",
    label: "Moderadamente ativo",
    hint: "exercício 3 a 5 dias por semana",
    factor: 1.55,
  },
  { key: "intenso", label: "Muito ativo", hint: "exercício 6 a 7 dias por semana", factor: 1.725 },
  {
    key: "muito_intenso",
    label: "Extremamente ativo",
    hint: "treino pesado diário ou trabalho braçal",
    factor: 1.9,
  },
];

export const LIMITS = {
  age: { min: 18, max: 90 },
  weightKg: { min: 30, max: 300 },
  heightCm: { min: 120, max: 230 },
} as const;

/** Divisão do dia em refeições e a fatia das calorias de cada uma. */
export const MEAL_SPLIT = [
  { meal: "Café da manhã", share: 0.25 },
  { meal: "Lanche da manhã", share: 0.1 },
  { meal: "Almoço", share: 0.3 },
  { meal: "Lanche da tarde", share: 0.1 },
  { meal: "Jantar", share: 0.25 },
] as const;

export type MealTarget = {
  meal: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type NutritionTargets = {
  inputs: BodyData & { goal: Goal };
  bmi: number;
  bmiClass: string;
  bmr: number;
  tdee: number;
  /** Ajuste aplicado ao gasto total, em kcal (negativo = déficit). */
  adjustmentKcal: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  meals: MealTarget[];
  warnings: string[];
};

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function validateBody(b: Partial<BodyData>): ValidationResult {
  const { age, weightKg, heightCm } = b;
  if (b.sex !== "feminino" && b.sex !== "masculino") {
    return { ok: false, message: "Informe o sexo biológico." };
  }
  if (!Number.isFinite(age) || age! < LIMITS.age.min) {
    return {
      ok: false,
      message:
        "O plano calculado é para maiores de 18 anos. Para menores, procure um nutricionista ou pediatra.",
    };
  }
  if (age! > LIMITS.age.max) return { ok: false, message: "Informe uma idade válida." };
  if (
    !Number.isFinite(weightKg) ||
    weightKg! < LIMITS.weightKg.min ||
    weightKg! > LIMITS.weightKg.max
  ) {
    return {
      ok: false,
      message: `Peso entre ${LIMITS.weightKg.min} e ${LIMITS.weightKg.max} kg.`,
    };
  }
  if (
    !Number.isFinite(heightCm) ||
    heightCm! < LIMITS.heightCm.min ||
    heightCm! > LIMITS.heightCm.max
  ) {
    return {
      ok: false,
      message: `Altura entre ${LIMITS.heightCm.min} e ${LIMITS.heightCm.max} cm.`,
    };
  }
  if (!ACTIVITY_OPTIONS.some((a) => a.key === b.activity)) {
    return { ok: false, message: "Escolha seu nível de atividade física." };
  }
  return { ok: true };
}

/** Descobre o objetivo a partir do texto livre ou do chip escolhido. */
export function detectGoal(objective: string): Goal {
  const o = objective.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/(perder|emagrec|secar|definic|definir|queimar|reduzir peso|baixar peso)/.test(o)) {
    return "perder_peso";
  }
  if (/(ganhar|massa|hipertrof|ganho|volume|bulking)/.test(o)) return "ganhar_massa";
  if (/colesterol|triglic/.test(o)) return "colesterol";
  if (/(manter|manutencao)/.test(o)) return "manter_peso";
  return "saudavel";
}

export const GOAL_LABEL: Record<Goal, string> = {
  perder_peso: "Perder peso",
  ganhar_massa: "Ganhar massa muscular",
  manter_peso: "Manter o peso",
  saudavel: "Alimentação saudável",
  colesterol: "Reduzir o colesterol",
};

function bmiClass(bmi: number): string {
  if (bmi < 18.5) return "abaixo do peso";
  if (bmi < 25) return "peso adequado";
  if (bmi < 30) return "sobrepeso";
  if (bmi < 35) return "obesidade grau I";
  if (bmi < 40) return "obesidade grau II";
  return "obesidade grau III";
}

const round = (n: number, step = 1) => Math.round(n / step) * step;

export function calculateTargets(body: BodyData, goal: Goal): NutritionTargets {
  const warnings: string[] = [];
  const { sex, age, weightKg, heightCm, activity } = body;

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  // Mifflin-St Jeor
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "masculino" ? 5 : -161);
  const factor = ACTIVITY_OPTIONS.find((a) => a.key === activity)!.factor;
  const tdee = bmr * factor;

  // Ajuste do objetivo
  let adjustment = 0;
  if (goal === "perder_peso") adjustment = -0.2 * tdee;
  else if (goal === "ganhar_massa") adjustment = Math.min(0.1 * tdee, 500);

  if (adjustment < 0) {
    if (body.pregnantOrLactating) {
      adjustment = 0;
      warnings.push(
        "Gestantes e lactantes não devem fazer déficit calórico. O plano foi calculado para manter o peso — combine as metas com seu obstetra ou nutricionista.",
      );
    } else if (bmi < 18.5) {
      adjustment = 0;
      warnings.push(
        "Seu IMC está abaixo de 18,5, então não aplicamos déficit calórico. O plano foi calculado para manter o peso — procure um nutricionista.",
      );
    } else if (bmi < 20) {
      adjustment = Math.max(adjustment, -0.1 * tdee);
      warnings.push("Com seu IMC, limitamos o déficit a 10% para a perda ser segura.");
    }
  }
  if (body.pregnantOrLactating) {
    warnings.push(
      "Na gestação e na lactação as necessidades de energia e nutrientes aumentam. Este plano é uma estimativa geral: faça o acompanhamento com profissional de saúde.",
    );
  }

  let kcal = tdee + adjustment;
  // Piso de segurança: nunca abaixo do gasto basal nem do mínimo usual
  const floor = Math.max(bmr, sex === "masculino" ? 1500 : 1200);
  if (kcal < floor) {
    kcal = Math.min(floor, tdee);
    if (goal === "perder_peso") {
      warnings.push(
        "O déficit foi limitado para a meta não ficar abaixo do seu gasto basal (ou do mínimo seguro de calorias). Emagrecer mais rápido que isso só com acompanhamento profissional.",
      );
    }
  }
  kcal = round(kcal, 10);
  const effectiveAdjustment = round(kcal - tdee, 10);

  // Proteína por kg. Em obesidade usa o peso ajustado, para não inflar a meta.
  const idealWeight = 25 * heightM * heightM;
  const refWeight = bmi >= 30 ? idealWeight + 0.25 * (weightKg - idealWeight) : weightKg;
  const proteinPerKg = goal === "perder_peso" || goal === "ganhar_massa" ? 1.8 : 1.2;
  let proteinG = refWeight * proteinPerKg;
  proteinG = Math.min(proteinG, (0.35 * kcal) / 4);
  proteinG = Math.max(proteinG, (0.1 * kcal) / 4);

  const fatShare = goal === "colesterol" ? 0.25 : 0.28;
  let fatG = Math.max((fatShare * kcal) / 9, 0.6 * weightKg);

  let carbsG = (kcal - proteinG * 4 - fatG * 9) / 4;
  // Carboidrato nunca abaixo de 100 g/dia (cérebro e rotina): tira da gordura
  if (carbsG < 100) {
    carbsG = 100;
    fatG = Math.max((kcal - proteinG * 4 - carbsG * 4) / 9, 0.5 * weightKg);
  }

  proteinG = round(proteinG);
  fatG = round(fatG);
  carbsG = round(Math.max(carbsG, 0));

  const meals: MealTarget[] = MEAL_SPLIT.map((m) => ({
    meal: m.meal,
    kcal: round(kcal * m.share, 5),
    proteinG: round(proteinG * m.share),
    carbsG: round(carbsG * m.share),
    fatG: round(fatG * m.share),
  }));

  if (age >= 65) {
    warnings.push(
      "Acima dos 65 anos as necessidades de proteína e cálcio merecem atenção especial: confirme este plano com um nutricionista.",
    );
  }

  return {
    inputs: { ...body, goal },
    bmi: Math.round(bmi * 10) / 10,
    bmiClass: bmiClass(bmi),
    bmr: round(bmr),
    tdee: round(tdee),
    adjustmentKcal: effectiveAdjustment,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: round((14 * kcal) / 1000),
    waterMl: round(35 * weightKg, 50),
    meals,
    warnings,
  };
}

/** Calorias a partir dos macros (Atwater): 4 kcal/g proteína e carboidrato, 9 kcal/g gordura. */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}
