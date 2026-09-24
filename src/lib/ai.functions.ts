import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveTier } from "@/lib/plans";

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
    console.warn(`ai.functions: chave principal esgotada/indisponível (status ${resp.status}), tentando chave backup`);
    resp = await fetchAI(backupKey, payload);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.error("ai gateway", resp.status, detail);
    if (resp.status === 429) throw new Error("Muitas requisições. Tente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
    if (resp.status === 503) throw new Error("O chef está temporariamente sobrecarregado. Tente novamente em alguns instantes.");
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
  .inputValidator((input: { image: string; pantry?: string[] }) => {
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

export type DietPlan = {
  title: string;
  summary: string;
  daily_calories_target: number | null;
  tips: string[];
  days: {
    day: string;
    meals: { meal: string; name: string; description?: string; calories?: number | null }[];
    total_calories?: number | null;
  }[];
};

export const generateDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { objective: string; restrictions?: string[]; notes?: string; pantry?: string[] }) => {
      if (!input?.objective || input.objective.trim().length < 3) {
        throw new Error("Descreva seu objetivo.");
      }
      return {
        objective: input.objective.trim().slice(0, 300),
        restrictions: (input.restrictions ?? []).slice(0, 20).map((r) => String(r).slice(0, 40)),
        notes: (input.notes ?? "").slice(0, 800),
        pantry: (input.pantry ?? []).slice(0, 80).map((p) => String(p).slice(0, 60)),
      };
    },
  )
  .handler(async ({ data, context }): Promise<DietPlan> => {
    await requirePlan(context.supabase as unknown as SupabaseLike, context.userId, ["premium"]);

    const result = (await callGateway(
      [
        {
          role: "system",
          content:
            "Você é um nutricionista e chef brasileiro. Monte cardápios semanais realistas com ingredientes acessíveis no Brasil. Responda SEMPRE em português do Brasil e SOMENTE com JSON válido, sem markdown.",
        },
        {
          role: "user",
          content: `Monte um plano alimentar de 7 dias.
Objetivo: ${data.objective}
Restrições: ${data.restrictions.join(", ") || "nenhuma"}
Observações: ${data.notes || "nenhuma"}
Itens já disponíveis na despensa: ${data.pantry.join(", ") || "não informado"}

Formato exato:
{"title":"","summary":"","daily_calories_target":2000,"tips":["dica"],"days":[{"day":"Segunda","total_calories":1950,"meals":[{"meal":"Café da manhã","name":"","description":"","calories":350}]}]}
Inclua café da manhã, almoço, lanche e jantar em cada dia.`,
        },
      ],
      0.9,
    )) as DietPlan;

    return result;
  });
