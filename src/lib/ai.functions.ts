import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveTier } from "@/lib/plans";
import { CATEGORIES, isValidCategory } from "@/lib/pantry-category";
import { nutritionFromMacros, type RecipeNutrition } from "@/lib/recipe-nutrition";
import {
  GOAL_LABEL,
  calculateTargets,
  detectGoal,
  kcalFromMacros,
  validateBody,
  type BodyData,
  type NutritionTargets,
} from "@/lib/nutrition";

// Gateway de IA compatível com a API OpenAI (/v1/chat/completions).
// Trocar de provedor é só mudar estas variáveis de ambiente — nenhum código muda.
// Padrão: Google AI Studio, que mantém os mesmos modelos Gemini usados antes.
const GATEWAY =
  process.env["AI_GATEWAY_URL"] ??
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const AI_MODEL = process.env["AI_MODEL"] ?? "gemini-2.5-flash";

type GatewayMessage = {
  role: "system" | "user";
  content: string | Array<Record<string, unknown>>;
};

// Mesmo padrão de resiliência usado em supabase/functions/generate-recipes e
// pantry-chat: tenta a chave reserva quando a principal esgota cota (429/402/
// 403) ou o modelo está sobrecarregado do lado do provedor (503), e usa um
// timeout para não deixar a função (e a tela) presa se a IA simplesmente não
// responder. Antes desta função não tinha nenhuma das duas coisas — "tirar
// foto da despensa" e "gerar plano alimentar" quebravam direto num 503,
// mesmo já tendo corrigido o mesmo problema em geração de receitas e no chat.
const RETRYABLE_STATUS = [429, 402, 403, 503];
const AI_TIMEOUT_MS = 45_000;

async function fetchAI(key: string, payload: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("ai.functions: falha ou timeout ao chamar a IA", err);
    return new Response(null, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

async function callGateway(messages: GatewayMessage[], temperature = 0.8) {
  const key = process.env["AI_API_KEY"];
  if (!key) throw new Error("IA não configurada.");
  const backupKey = process.env["AI_API_KEY_BACKUP"];

  const payload = { model: AI_MODEL, temperature, messages };
  let resp = await fetchAI(key, payload);
  if (!resp.ok && backupKey && RETRYABLE_STATUS.includes(resp.status)) {
    console.warn(
      `ai.functions: chave principal esgotada/indisponível (status ${resp.status}), tentando chave backup`,
    );
    resp = await fetchAI(backupKey, payload);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.error("ai gateway", resp.status, detail);
    if (resp.status === 429) throw new Error("Muitas requisições. Tente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
    if (resp.status === 503)
      throw new Error(
        "O chef está temporariamente sobrecarregado. Tente novamente em alguns instantes.",
      );
    throw new Error("Erro ao falar com a IA.");
  }

  const data = await resp.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta da IA inválida.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { plan_tier?: string; status?: string; current_period_end?: string | null } | null;
        }>;
      };
    };
  };
};

async function requirePlan(
  supabase: SupabaseLike,
  userId: string,
  allowed: string[],
): Promise<void> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_tier, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  const tier = effectiveTier(data?.plan_tier, data?.status, data?.current_period_end);
  if (!allowed.includes(tier)) {
    throw new Error("Seu plano atual não inclui este recurso.");
  }
}

export type RecognizedPhoto = {
  items: string[];
  main_item: string;
  recipe: {
    title: string;
    description?: string | null;
    category?: string | null;
    time_minutes?: number | null;
    difficulty?: string | null;
    diet?: string[] | null;
    ingredients?: string[] | null;
    instructions?: string | null;
    calories_per_serving?: number | null;
    cost_home_brl?: number | null;
    cost_delivery_brl?: number | null;
  };
};

export const recognizePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { image: string; pantry?: string[] }) => {
    if (!input?.image || typeof input.image !== "string" || input.image.length > 8_000_000) {
      throw new Error("Imagem inválida.");
    }
    return {
      image: input.image,
      pantry: (input.pantry ?? []).slice(0, 60).map((p) => String(p).slice(0, 60)),
    };
  })
  .handler(async ({ data, context }): Promise<RecognizedPhoto> => {
    await requirePlan(context.supabase as unknown as SupabaseLike, context.userId, [
      "basico",
      "premium",
    ]);

    const pantryList = data.pantry.join(", ");
    const result = (await callGateway([
      {
        role: "system",
        content:
          "Você é um chef brasileiro que identifica ingredientes em fotos e cria uma receita com eles. Responda SEMPRE em português do Brasil e SOMENTE com JSON válido, sem markdown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Identifique os ingredientes visíveis nesta foto e crie UMA receita usando principalmente eles.${
              pantryList ? ` A pessoa também tem em casa: ${pantryList}.` : ""
            }
Formato exato:
{"items":["ingrediente"],"main_item":"principal","recipe":{"title":"","description":"","category":"prato principal","time_minutes":30,"difficulty":"fácil","diet":[],"ingredients":["quantidade + item"],"instructions":"1. ...\\n2. ...","calories_per_serving":400,"cost_home_brl":18,"cost_delivery_brl":45}}`,
          },
          { type: "image_url", image_url: { url: data.image } },
        ],
      },
    ])) as RecognizedPhoto;

    return {
      items: Array.isArray(result.items) ? result.items : [],
      main_item: result.main_item ?? "",
      recipe: result.recipe,
    };
  });

export type DietMeal = {
  meal: string;
  name: string;
  description?: string;
  /** Alimentos com a quantidade exata de cada um */
  items?: { food: string; quantity: string }[];
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

export type DietDay = {
  day: string;
  meals: DietMeal[];
  total_calories?: number | null;
  total_protein_g?: number | null;
  total_carbs_g?: number | null;
  total_fat_g?: number | null;
};

export type DietPlan = {
  title: string;
  summary: string;
  daily_calories_target: number | null;
  tips: string[];
  days: DietDay[];
  /** Metas calculadas (gasto basal, gasto total, macros) usadas para montar o plano */
  nutrition?: NutritionTargets;
};

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Deixa o plano internamente consistente: as calorias de cada refeição saem dos
 * macros (4/4/9), e os totais do dia são a soma das refeições. Assim a IA não
 * consegue "inventar" um total que não bate com o que está no prato.
 */
function normalizePlan(plan: DietPlan, t: NutritionTargets): DietPlan {
  const days = (Array.isArray(plan.days) ? plan.days : []).slice(0, 7).map((d, i) => {
    const meals = (Array.isArray(d.meals) ? d.meals : []).map((m) => {
      const p = num(m.protein_g);
      const c = num(m.carbs_g);
      const f = num(m.fat_g);
      const hasMacros = p + c + f > 0;
      return {
        ...m,
        protein_g: hasMacros ? Math.round(p) : null,
        carbs_g: hasMacros ? Math.round(c) : null,
        fat_g: hasMacros ? Math.round(f) : null,
        calories: hasMacros ? kcalFromMacros(p, c, f) : num(m.calories) || null,
        items: Array.isArray(m.items)
          ? m.items
              .filter((it) => it && typeof it.food === "string")
              .map((it) => ({ food: String(it.food), quantity: String(it.quantity ?? "") }))
          : [],
      } satisfies DietMeal;
    });
    const sum = (k: "calories" | "protein_g" | "carbs_g" | "fat_g") =>
      meals.reduce((acc, m) => acc + (m[k] ?? 0), 0);
    return {
      day: d.day || WEEK_DAYS[i] || `Dia ${i + 1}`,
      meals,
      total_calories: sum("calories"),
      total_protein_g: sum("protein_g"),
      total_carbs_g: sum("carbs_g"),
      total_fat_g: sum("fat_g"),
    } satisfies DietDay;
  });
  return {
    title: plan.title,
    summary: plan.summary,
    tips: Array.isArray(plan.tips) ? plan.tips : [],
    daily_calories_target: t.kcal,
    days,
    nutrition: t,
  };
}

/** Dias cujo total fugiu mais de `tolerance` da meta — voltam para a IA corrigir. */
function offTargetDays(plan: DietPlan, t: NutritionTargets, tolerance = 0.07): string[] {
  const out: string[] = [];
  for (const d of plan.days) {
    const total = d.total_calories ?? 0;
    const diff = (total - t.kcal) / t.kcal;
    if (Math.abs(diff) > tolerance || d.meals.length < 5) {
      out.push(
        `${d.day}: ${total} kcal (meta ${t.kcal}; ${d.meals.length} refeições, precisam ser 5)`,
      );
    }
  }
  if (plan.days.length < 7) out.push(`o plano tem só ${plan.days.length} dias; precisa ter 7`);
  return out;
}

export const generateDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      objective: string;
      restrictions?: string[];
      notes?: string;
      pantry?: string[];
      body: BodyData;
    }) => {
      if (!input?.objective || input.objective.trim().length < 3) {
        throw new Error("Descreva seu objetivo.");
      }
      const body: BodyData = {
        sex: input.body?.sex,
        age: Number(input.body?.age),
        weightKg: Number(input.body?.weightKg),
        heightCm: Number(input.body?.heightCm),
        activity: input.body?.activity,
        pregnantOrLactating: input.body?.sex === "feminino" && !!input.body?.pregnantOrLactating,
      };
      const check = validateBody(body);
      if (!check.ok) throw new Error(check.message);
      return {
        objective: input.objective.trim().slice(0, 300),
        restrictions: (input.restrictions ?? []).slice(0, 20).map((r) => String(r).slice(0, 40)),
        notes: (input.notes ?? "").slice(0, 800),
        pantry: (input.pantry ?? []).slice(0, 80).map((p) => String(p).slice(0, 60)),
        body,
      };
    },
  )
  .handler(async ({ data, context }): Promise<DietPlan> => {
    await requirePlan(context.supabase as unknown as SupabaseLike, context.userId, ["premium"]);

    // As metas são recalculadas aqui: o servidor nunca confia nos números do navegador.
    const goal = detectGoal(data.objective);
    const t = calculateTargets(data.body, goal);

    const mealLines = t.meals
      .map(
        (m) =>
          `- ${m.meal}: ~${m.kcal} kcal | proteína ${m.proteinG} g | carboidrato ${m.carbsG} g | gordura ${m.fatG} g`,
      )
      .join("\n");

    const colesterolRule =
      goal === "colesterol"
        ? "\n6. Foco em reduzir o colesterol: gorduras saturadas baixas, muita fibra solúvel (aveia, frutas, leguminosas), peixes e oleaginosas, sem frituras nem embutidos."
        : "";

    const basePrompt = `Monte um plano alimentar de 7 dias (Segunda a Domingo) para esta pessoa.

PERFIL
- Sexo: ${t.inputs.sex}, ${t.inputs.age} anos, ${t.inputs.weightKg} kg, ${t.inputs.heightCm} cm (IMC ${t.bmi}, ${t.bmiClass})
- Objetivo: ${data.objective} (${GOAL_LABEL[goal]})
- Restrições alimentares: ${data.restrictions.join(", ") || "nenhuma"}
- Observações (alergias, condições de saúde, rotina): ${data.notes || "nenhuma"}
- Itens que a pessoa já tem na despensa (priorize): ${data.pantry.join(", ") || "não informado"}

METAS DIÁRIAS JÁ CALCULADAS (siga à risca, em TODOS os 7 dias)
- Total: ${t.kcal} kcal | proteína ${t.proteinG} g | carboidrato ${t.carbsG} g | gordura ${t.fatG} g | fibras ${t.fiberG} g
Distribuição por refeição (5 refeições por dia):
${mealLines}

REGRAS
1. Cada refeição deve ter a lista de alimentos com a QUANTIDADE EXATA de cada um (gramas, mL ou medida caseira, ex.: "arroz integral cozido — 120 g (4 col. de sopa)").
2. Informe os macros de cada refeição (protein_g, carbs_g, fat_g) coerentes com os alimentos e quantidades listados. NÃO informe calorias: elas são calculadas a partir dos macros.
3. A soma dos macros de cada dia tem que ficar dentro de ±5% das metas acima.
4. Use alimentos comuns e baratos no Brasil, respeite TODAS as restrições e alergias, varie os pratos ao longo da semana e priorize a despensa.
5. Não faça nenhuma promessa de tratamento nem indique suplementos ou medicamentos.${colesterolRule}

Responda SOMENTE com JSON válido neste formato exato:
{"title":"","summary":"resumo curto do plano e da lógica das metas","tips":["dica prática"],"days":[{"day":"Segunda","meals":[{"meal":"Café da manhã","name":"nome do prato","description":"modo de preparo curto","items":[{"food":"alimento","quantity":"quantidade"}],"protein_g":0,"carbs_g":0,"fat_g":0}]}]}`;

    const system =
      "Você é um nutricionista brasileiro que monta cardápios com cálculo preciso de porções e macronutrientes. Responda SEMPRE em português do Brasil e SOMENTE com JSON válido, sem markdown.";

    let plan = normalizePlan(
      (await callGateway(
        [
          { role: "system", content: system },
          { role: "user", content: basePrompt },
        ],
        0.6,
      )) as DietPlan,
      t,
    );

    // Uma segunda chance quando algum dia fugiu da meta
    const problems = offTargetDays(plan, t);
    if (problems.length > 0) {
      try {
        const fixed = normalizePlan(
          (await callGateway(
            [
              { role: "system", content: system },
              {
                role: "user",
                content: `${basePrompt}

ATENÇÃO: uma versão anterior saiu fora da meta nestes pontos:
${problems.join("\n")}
Refaça o plano COMPLETO (7 dias, 5 refeições por dia) ajustando as quantidades e os macros para cada dia fechar em ${t.kcal} kcal (±5%).`,
              },
            ],
            0.4,
          )) as DietPlan,
          t,
        );
        if (offTargetDays(fixed, t).length <= problems.length) plan = fixed;
      } catch (e) {
        console.error("generateDietPlan retry", e);
      }
    }

    if (plan.days.length === 0) {
      throw new Error("A IA não conseguiu montar o cardápio. Tente de novo.");
    }
    return plan;
  });

// Categoria de um ingrediente que o dicionário local da despensa não reconheceu.
// Não exige plano pago (a despensa é gratuita). O cache em memória evita chamar
// a IA de novo para o mesmo nome.
const categoryCache = new Map<string, string>();

export const categorizeIngredient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { name: string }) => {
    const name = String(input?.name ?? "")
      .trim()
      .slice(0, 80);
    if (name.length < 2) throw new Error("Nome inválido.");
    return { name };
  })
  .handler(async ({ data }): Promise<{ category: string | null }> => {
    const key = data.name.toLowerCase();
    const cached = categoryCache.get(key);
    if (cached) return { category: cached };

    try {
      const result = (await callGateway(
        [
          {
            role: "system",
            content:
              "Você classifica itens de despensa e cozinha brasileira em categorias. Responda SOMENTE com JSON válido, sem markdown.",
          },
          {
            role: "user",
            content: `Item digitado: "${data.name}"
Escolha a categoria que melhor descreve esse item, usando EXATAMENTE um destes valores:
${CATEGORIES.join(", ")}
Se o item não for um alimento ou bebida reconhecível, use "Outros".
Formato: {"category":"..."}`,
          },
        ],
        0,
      )) as { category?: string };
      if (isValidCategory(result.category)) {
        categoryCache.set(key, result.category);
        return { category: result.category };
      }
    } catch (e) {
      console.error("categorizeIngredient", e);
    }
    return { category: null };
  });

// Informação nutricional por porção de uma receita que ainda não tem (salvas
// antes, importadas ou vindas do chat). Não exige plano pago. É uma estimativa
// da IA; as calorias saem dos macros (4/4/9), para os números fecharem entre si.
// O cache em memória evita estimar duas vezes a mesma receita.
const nutritionCache = new Map<string, RecipeNutrition>();

export const estimateRecipeNutrition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      title: string;
      ingredients: string[];
      servings?: number;
      knownCalories?: number;
    }) => {
      const title = String(input?.title ?? "")
        .trim()
        .slice(0, 160);
      const ingredients = (Array.isArray(input?.ingredients) ? input.ingredients : [])
        .slice(0, 40)
        .map((i) => String(i).trim().slice(0, 160))
        .filter(Boolean);
      if (title.length < 2 || ingredients.length === 0)
        throw new Error("Receita sem ingredientes.");
      const servings = Math.min(Math.max(Math.round(Number(input?.servings) || 4), 1), 20);
      const known = Number(input?.knownCalories);
      return {
        title,
        ingredients,
        servings,
        knownCalories:
          Number.isFinite(known) && known > 0 && known < 3000 ? Math.round(known) : null,
      };
    },
  )
  .handler(async ({ data }): Promise<{ nutrition: RecipeNutrition | null }> => {
    const key = `${data.title}|${data.servings}|${data.ingredients.join(";")}`.toLowerCase();
    const cached = nutritionCache.get(key);
    if (cached) return { nutrition: cached };

    const ingredientLines = data.ingredients.map((i) => `- ${i}`).join("\n");
    const referenceLine = data.knownCalories
      ? `Referência: a receita foi estimada em cerca de ${data.knownCalories} kcal por porção; mantenha os valores coerentes com isso.`
      : "";

    try {
      const result = (await callGateway(
        [
          {
            role: "system",
            content:
              "Você é um nutricionista brasileiro que calcula a informação nutricional de receitas a partir dos ingredientes e das quantidades. Responda SOMENTE com JSON válido, sem markdown.",
          },
          {
            role: "user",
            content: `Receita: ${data.title}
Rende ${data.servings} porções.
Ingredientes:
${ingredientLines}
${referenceLine}
Calcule os valores POR PORÇÃO (some os ingredientes e divida por ${data.servings}). Informe gramas de proteína, carboidrato e gordura. Não informe calorias.
Formato: {"protein":0,"carbs":0,"fat":0}`,
          },
        ],
        0.2,
      )) as { protein?: number; carbs?: number; fat?: number };
      const nutrition = nutritionFromMacros(
        Number(result.protein),
        Number(result.carbs),
        Number(result.fat),
      );
      if (nutrition && nutrition.calories >= 30 && nutrition.calories <= 3000) {
        nutritionCache.set(key, nutrition);
        return { nutrition };
      }
    } catch (e) {
      console.error("estimateRecipeNutrition", e);
    }
    return { nutrition: null };
  });
