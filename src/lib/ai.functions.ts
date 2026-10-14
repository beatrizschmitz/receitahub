import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveTier } from "@/lib/plans";
import { CATEGORIES, isValidCategory } from "@/lib/pantry-category";
import { nutritionFromMacros, type RecipeNutrition } from "@/lib/recipe-nutrition";
import { resolveIngredient, summarizeRecipe, type RawIngredient } from "@/lib/recipe-taco";
import { promptFoodList } from "@/lib/taco";
import { DIET_SYSTEM, RECIPE_SYSTEM, dietTacoPrompt, recipeTacoPrompt } from "@/lib/taco-prompts";
import { buildDay, type RawDay } from "@/lib/diet-taco";
import {
  GOAL_LABEL,
  calculateTargets,
  detectGoal,
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
  /** Os nutrientes vêm da tabela TACO (planos novos) */
  source?: "taco";
};

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

type RawPlan = {
  title?: unknown;
  summary?: unknown;
  tips?: unknown;
  days?: unknown;
};

/**
 * Transforma a escolha de alimentos da IA em plano: nutrientes da TACO, gramas
 * ajustadas por refeição para fechar a meta, totais por dia somados pelo código.
 * Devolve também os pontos que fugiram do esperado (para a segunda tentativa).
 */
function buildPlanFromTaco(
  raw: RawPlan,
  t: NutritionTargets,
): { plan: DietPlan; issues: string[] } {
  const rawDays = (Array.isArray(raw.days) ? raw.days : []).slice(0, 7) as RawDay[];
  const built = rawDays.map((d, i) =>
    buildDay(
      d,
      i,
      WEEK_DAYS,
      t.meals.map((m) => ({ meal: m.meal, kcal: m.kcal })),
      t.kcal,
      t.proteinG,
    ),
  );
  const issues = built.flatMap((d) => d.issues);
  if (built.length < 7) issues.push(`o plano tem só ${built.length} dias; precisa ter 7`);

  const round = (n: number) => Math.round(n);
  const days: DietDay[] = built.map((d) => ({
    day: d.day,
    meals: d.meals.map(
      (m): DietMeal => ({
        meal: m.meal,
        name: m.name,
        description: m.description || undefined,
        items: m.items.map((i) => ({ food: i.food.name, quantity: `${i.grams} g` })),
        calories: round(m.nutrients.kcal),
        protein_g: round(m.nutrients.protein),
        carbs_g: round(m.nutrients.carbs),
        fat_g: round(m.nutrients.fat),
      }),
    ),
    total_calories: round(d.totals.kcal),
    total_protein_g: round(d.totals.protein),
    total_carbs_g: round(d.totals.carbs),
    total_fat_g: round(d.totals.fat),
  }));

  return {
    plan: {
      title: typeof raw.title === "string" ? raw.title.slice(0, 120) : "Plano alimentar",
      summary: typeof raw.summary === "string" ? raw.summary.slice(0, 600) : "",
      tips: (Array.isArray(raw.tips) ? raw.tips : [])
        .filter((x): x is string => typeof x === "string")
        .slice(0, 8)
        .map((x) => x.slice(0, 240)),
      daily_calories_target: t.kcal,
      days,
      nutrition: t,
      source: "taco",
    },
    issues,
  };
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

    const basePrompt = dietTacoPrompt({
      t,
      objective: data.objective,
      goalLabel: GOAL_LABEL[goal],
      colesterol: goal === "colesterol",
      restrictions: data.restrictions,
      notes: data.notes,
      pantry: data.pantry,
    });

    const system = DIET_SYSTEM;

    let best = buildPlanFromTaco(
      (await callGateway(
        [
          { role: "system", content: system },
          { role: "user", content: basePrompt },
        ],
        0.6,
      )) as RawPlan,
      t,
    );

    // Uma segunda chance quando algo ficou fora do esperado
    if (best.issues.length > 0) {
      try {
        const retry = buildPlanFromTaco(
          (await callGateway(
            [
              { role: "system", content: system },
              {
                role: "user",
                content: `${basePrompt}

ATENÇÃO: uma versão anterior teve estes problemas:
${best.issues.slice(0, 20).join("\n")}
Refaça o plano COMPLETO (7 dias, 5 refeições por dia, só alimentos da tabela) corrigindo esses pontos.`,
              },
            ],
            0.4,
          )) as RawPlan,
          t,
        );
        if (retry.issues.length <= best.issues.length) best = retry;
      } catch (e) {
        console.error("generateDietPlan retry", e);
      }
    }

    if (
      best.plan.days.length === 0 ||
      best.plan.days.every((d) => d.meals.every((m) => !m.items?.length))
    ) {
      throw new Error("A IA não conseguiu montar o cardápio. Tente de novo.");
    }
    return best.plan;
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
// antes, importadas ou vindas do chat), ou que só tem a estimativa da IA. Não
// exige plano pago.
//
// 1) Calcula com a TACO: a IA identifica o alimento da tabela e a medida de cada
//    ingrediente; as gramas e os nutrientes são calculados no código.
// 2) Se a tabela cobrir pouco da receita, cai na estimativa da IA (macros ->
//    calorias por 4/4/9), marcada como "ia".
// O cache em memória evita calcular duas vezes a mesma receita.
const nutritionCache = new Map<string, RecipeNutrition>();

async function nutritionFromTaco(
  title: string,
  ingredients: string[],
  servings: number,
): Promise<RecipeNutrition | null> {
  const result = (await callGateway(
    [
      { role: "system", content: RECIPE_SYSTEM },
      { role: "user", content: recipeTacoPrompt(title, ingredients, servings) },
    ],
    0,
  )) as { items?: RawIngredient[] };

  const items = (Array.isArray(result.items) ? result.items : []).slice(0, ingredients.length);
  const totals = summarizeRecipe(items.map(resolveIngredient), servings);
  const n = totals?.nutrition;
  // calorias fora do plausível por porção indicam erro de leitura da IA
  if (!n || n.calories < 30 || n.calories > 3000) return null;
  return n;
}

async function nutritionFromAi(
  title: string,
  ingredients: string[],
  servings: number,
  knownCalories: number | null,
): Promise<RecipeNutrition | null> {
  const ingredientLines = ingredients.map((i) => `- ${i}`).join("\n");
  const referenceLine = knownCalories
    ? `Referência: a receita foi estimada em cerca de ${knownCalories} kcal por porção; mantenha os valores coerentes com isso.`
    : "";
  const result = (await callGateway(
    [
      {
        role: "system",
        content:
          "Você é um nutricionista brasileiro que calcula a informação nutricional de receitas a partir dos ingredientes e das quantidades. Responda SOMENTE com JSON válido, sem markdown.",
      },
      {
        role: "user",
        content: `Receita: ${title}
Rende ${servings} porções.
Ingredientes:
${ingredientLines}
${referenceLine}
Calcule os valores POR PORÇÃO (some os ingredientes e divida por ${servings}). Informe gramas de proteína, carboidrato e gordura. Não informe calorias.
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
  if (!nutrition || nutrition.calories < 30 || nutrition.calories > 3000) return null;
  return { ...nutrition, source: "ia" };
}

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

    let nutrition: RecipeNutrition | null = null;
    try {
      nutrition = await nutritionFromTaco(data.title, data.ingredients, data.servings);
    } catch (e) {
      console.error("estimateRecipeNutrition (TACO)", e);
    }
    if (!nutrition) {
      try {
        nutrition = await nutritionFromAi(
          data.title,
          data.ingredients,
          data.servings,
          data.knownCalories,
        );
      } catch (e) {
        console.error("estimateRecipeNutrition (IA)", e);
      }
    }
    if (nutrition) nutritionCache.set(key, nutrition);
    return { nutrition };
  });
