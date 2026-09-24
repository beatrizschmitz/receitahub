import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// ─── Fotos do Pexels (cópia de supabase/functions/_shared/recipe-images.ts) ───
// Inlined de propósito: o editor do painel do Supabase aceita um arquivo só por
// função, então este index.ts precisa rodar sozinho. Se mexer aqui, espelhe em
// _shared/recipe-images.ts e na outra função que carrega a mesma cópia
// (generate-recipes / recipe-images).
//
// O cache é chaveado pelo termo de busca normalizado, não pela receita: o plano
// gratuito do Pexels permite 200 requisições por hora e, com 6 receitas por
// geração, sem cache o app estouraria em ~33 gerações/hora.

type RecipeImage = {
  image_url: string;
  photographer: string;
  photographer_url: string;
};

const PEXELS_URL = "https://api.pexels.com/v1/search";

// Um negativo em cache vale 30 dias — depois vale a pena tentar de novo, já que
// o acervo do Pexels cresce.
const NEGATIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Teto de buscas ao vivo por invocação. Protege o limite horário quando uma
// leva inteira de receitas vem com termos inéditos.
const MAX_LIVE_LOOKUPS = 8;

/** Minúsculas, sem acento, sem pontuação e sem espaço duplicado. */
function normalizeQuery(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

type CacheRow = {
  query: string;
  image_url: string | null;
  photographer: string | null;
  photographer_url: string | null;
  fetched_at: string;
};

function restHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

async function readCache(
  supabaseUrl: string,
  serviceKey: string,
  queries: string[],
): Promise<Map<string, CacheRow>> {
  const list = queries.map((q) => `"${q.replace(/"/g, '\\"')}"`).join(",");
  const res = await fetch(
    `${supabaseUrl}/rest/v1/recipe_images?query=in.(${encodeURIComponent(list)})` +
      `&select=query,image_url,photographer,photographer_url,fetched_at`,
    { headers: restHeaders(serviceKey) },
  );
  if (!res.ok) {
    console.error("recipe-images: falha ao ler cache", await res.text());
    return new Map();
  }
  const rows = (await res.json()) as CacheRow[];
  return new Map(rows.map((r) => [r.query, r]));
}

async function writeCache(
  supabaseUrl: string,
  serviceKey: string,
  rows: Array<Omit<CacheRow, "fetched_at">>,
) {
  if (rows.length === 0) return;
  const res = await fetch(`${supabaseUrl}/rest/v1/recipe_images`, {
    method: "POST",
    headers: {
      ...restHeaders(serviceKey),
      // upsert: um termo pode ter sido gravado por outra invocação no meio
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() }))),
  });
  if (!res.ok) console.error("recipe-images: falha ao gravar cache", await res.text());
}

async function searchPexels(query: string, apiKey: string): Promise<RecipeImage | null> {
  try {
    const res = await fetch(
      `${PEXELS_URL}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) {
      // 429 = limite horário estourado. Não é erro fatal: o card cai no emoji.
      console.error(`recipe-images: pexels ${res.status} para "${query}"`);
      return null;
    }
    const data = await res.json();
    const photo = data?.photos?.[0];
    const url = photo?.src?.large ?? photo?.src?.medium;
    if (!url) return null;
    return {
      image_url: url,
      photographer: photo.photographer ?? "",
      photographer_url: photo.photographer_url ?? "",
    };
  } catch (err) {
    console.error(`recipe-images: erro de rede em "${query}"`, err);
    return null;
  }
}

/**
 * Devolve um mapa termo-normalizado -> foto (ou null quando não há foto).
 * Nunca lança: qualquer falha vira null e o card usa o emoji de fallback.
 */
async function resolveRecipeImages(
  rawQueries: string[],
): Promise<Record<string, RecipeImage | null>> {
  const queries = [...new Set(rawQueries.map(normalizeQuery).filter(Boolean))];
  const out: Record<string, RecipeImage | null> = {};
  if (queries.length === 0) return out;

  const apiKey = Deno.env.get("PEXELS_API_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const cache =
    supabaseUrl && serviceKey ? await readCache(supabaseUrl, serviceKey, queries) : new Map();

  const misses: string[] = [];
  const now = Date.now();
  for (const q of queries) {
    const hit = cache.get(q);
    if (!hit) {
      misses.push(q);
      continue;
    }
    if (hit.image_url) {
      out[q] = {
        image_url: hit.image_url,
        photographer: hit.photographer ?? "",
        photographer_url: hit.photographer_url ?? "",
      };
      continue;
    }
    // negativo em cache: só tenta de novo depois do TTL
    if (now - new Date(hit.fetched_at).getTime() > NEGATIVE_TTL_MS) misses.push(q);
    else out[q] = null;
  }

  if (!apiKey) {
    // Sem chave, o que já estava em cache continua valendo; o resto vira emoji.
    if (misses.length > 0) console.error("recipe-images: PEXELS_API_KEY não configurada");
    for (const q of misses) out[q] = null;
    return out;
  }

  const toFetch = misses.slice(0, MAX_LIVE_LOOKUPS);
  for (const q of misses.slice(MAX_LIVE_LOOKUPS)) out[q] = null;

  const found = await Promise.all(toFetch.map((q) => searchPexels(q, apiKey)));
  toFetch.forEach((q, i) => {
    out[q] = found[i];
  });

  if (supabaseUrl && serviceKey) {
    await writeCache(
      supabaseUrl,
      serviceKey,
      toFetch.map((q, i) => ({
        query: q,
        image_url: found[i]?.image_url ?? null,
        photographer: found[i]?.photographer ?? null,
        photographer_url: found[i]?.photographer_url ?? null,
      })),
    );
  }

  return out;
}

// ─── fim da cópia ────────────────────────────────────────────────────────────

const AI_API_KEY = Deno.env.get("AI_API_KEY") ?? "";
const AI_API_KEY_BACKUP = Deno.env.get("AI_API_KEY_BACKUP") ?? "";
// Gateway de IA compatível com a API OpenAI (/v1/chat/completions).
// Trocar de provedor é só mudar estas variáveis de ambiente — nenhum código muda.
// Padrão: Google AI Studio, que mantém os mesmos modelos Gemini usados antes.
const AI_URL =
  Deno.env.get("AI_GATEWAY_URL") ??
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gemini-2.5-flash";

// Fallback de chave de IA — duplicado em pantry-chat/index.ts (mesma lógica,
// só muda o nome da função no log). Cada edge function é auto-contida (ver
// nota do painel no topo do arquivo), então isso não vira um _shared/.
// Quando a chave principal esgota cota (429/402/403) OU o modelo está
// temporariamente sobrecarregado do lado do provedor (503), tenta a chave
// reserva antes de desistir. AI_API_KEY_BACKUP é opcional — sem ela, só a
// principal roda.
const RETRYABLE_STATUS = [429, 402, 403, 503];
// Teto de espera por tentativa. Sem isso, se a IA simplesmente não responder
// (trava de rede, não um erro explícito), a função fica presa até o limite da
// própria Supabase Edge Function — e a tela do usuário fica "carregando..."
// esse tempo todo. Um timeout vira um 503 comum, que já aciona a chave backup
// e a mensagem amigável de sempre.
const AI_TIMEOUT_MS = 45_000;

async function fetchAI(key: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    console.error("generate-recipes: falha ou timeout ao chamar a IA", err);
    return new Response(null, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

async function callAI(payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const primary = await fetchAI(AI_API_KEY, body);
  if (primary.ok || !AI_API_KEY_BACKUP || !RETRYABLE_STATUS.includes(primary.status)) {
    console.log(`generate-recipes: chave principal usada (status ${primary.status})`);
    return primary;
  }
  console.warn(
    `generate-recipes: chave principal esgotada/indisponível (status ${primary.status}), tentando chave backup`,
  );
  const backup = await fetchAI(AI_API_KEY_BACKUP, body);
  console.log(`generate-recipes: chave backup usada (status ${backup.status})`);
  return backup;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// A resposta da IA pode vir truncada (limite de tokens), o que quebra JSON.parse.
// Tentamos o parse normal e, se falhar, recuperamos apenas os objetos completos.
function safeParseRecipes(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.recipes)) return parsed.recipes;
  } catch (_) {
    // segue para o modo de recuperação
  }

  const key = text.indexOf('"recipes"');
  const arrStart = key === -1 ? text.indexOf("[") : text.indexOf("[", key);
  if (arrStart === -1) return [];

  const recipes: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try {
          recipes.push(JSON.parse(text.slice(objStart, i + 1)));
        } catch (_) {
          // ignora objeto inválido
        }
        objStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }
  return recipes;
}

// Anexa a foto resolvida a cada receita. O termo vem do image_query da IA; se
// ele vier vazio, o título serve de último recurso (costuma falhar em pratos
// regionais, mas é melhor que não buscar nada).
async function attachImages(recipes: unknown[]): Promise<unknown[]> {
  const queries = recipes.map((r) => {
    const rec = r as Record<string, unknown>;
    const q = typeof rec.image_query === "string" && rec.image_query.trim()
      ? rec.image_query
      : String(rec.title ?? "");
    return q;
  });

  let resolved: Record<string, { image_url: string; photographer: string; photographer_url: string } | null> = {};
  try {
    resolved = await resolveRecipeImages(queries);
  } catch (err) {
    console.error("generate-recipes: falha ao resolver imagens", err);
  }

  return recipes.map((r, i) => {
    const photo = resolved[normalizeQuery(queries[i])] ?? null;
    return {
      ...(r as Record<string, unknown>),
      image_url: photo?.image_url ?? null,
      image_photographer: photo?.photographer ?? null,
      image_photographer_url: photo?.photographer_url ?? null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { category = "todas", diet = [], ingredients = [], search = "", seed = "", exclude = [] } = body;
    const categoryPart = category && category !== "todas" ? `na categoria "${category}"` : "de qualquer categoria";
    const dietPart = diet.length > 0 ? `As receitas devem ser: ${diet.join(", ")}.` : "";
    const ingredientsPart = ingredients.length > 0 ? `Use preferencialmente estes ingredientes: ${ingredients.join(", ")}.` : "";
    const searchPart = search ? `O usuário busca por: "${search}".` : "";
    const excludePart = Array.isArray(exclude) && exclude.length > 0
      ? `Não repita estes pratos, que já aparecem em outra seção do site: ${exclude.join(", ")}. Gere receitas diferentes deles.`
      : "";
    const variationSeed = seed || Math.random().toString(36).slice(2);
    const inspirations = ["nordestina", "mineira", "paulista", "gaúcha", "baiana", "amazônica", "italiana abrasileirada", "japonesa abrasileirada", "árabe abrasileirada", "portuguesa", "caipira", "contemporânea", "vegetariana criativa", "comfort food", "de boteco", "de festa", "de domingo em família", "saudável", "low carb", "rápida do dia a dia"];
    const picks = [...inspirations].sort(() => Math.random() - 0.5).slice(0, 3).join(", ");
    const variationPart = `Surpreenda com receitas variadas e criativas — evite os clássicos óbvios. Inspire-se em estilos como: ${picks}. Token de variação (use para diversificar, não cite): ${variationSeed}.`;
    // image_query vai para um banco de fotos internacional (Pexels), que só
    // indexa em inglês — por isso é o único campo que foge do português.
    const systemPrompt = "Você é um chef brasileiro especialista e criativo. Sempre varia as sugestões e chama a função return_recipes exatamente uma vez. Responda em português do Brasil, com uma exceção: o campo image_query deve ser em INGLÊS, com 2 a 4 palavras, descrevendo o prato do jeito que um banco de fotos internacional encontraria (ex.: escondidinho de carne seca -> \"shepherds pie casserole\"; temaki -> \"sushi hand roll\"; moqueca -> \"seafood stew bowl\"). Prefira o tipo de prato ao nome regional. O modo de preparo deve ser uma única string com até 5 passos numerados separados por quebras de linha.";
    const userPrompt = `Gere exatamente 6 receitas ${categoryPart}. ${dietPart} ${ingredientsPart} ${searchPart} ${excludePart} ${variationPart}`;

    const aiRes = await callAI({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 1.1,
      max_tokens: 12000,
      tools: [{
          type: "function",
          function: {
            name: "return_recipes",
            description: "Retorna exatamente seis receitas completas",
            parameters: {
              type: "object",
              properties: {
                recipes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" }, title: { type: "string" },
                      description: { type: "string" }, category: { type: "string" },
                      time: { type: "string" }, time_minutes: { type: "number" },
                      image_query: { type: "string", description: "Termo de busca em inglês, 2 a 4 palavras, para achar uma foto do prato num banco de imagens" },
                      difficulty: { type: "string" },
                      diet: { type: "array", items: { type: "string" } },
                      servings: { type: "number" },
                      ingredients: { type: "array", items: { type: "string" } },
                      instructions: { type: "string" },
                      nutrition: {
                        type: "object",
                        properties: {
                          calories: { type: "number" }, protein: { type: "number" },
                          carbs: { type: "number" }, fat: { type: "number" },
                        },
                        required: ["calories", "protein", "carbs", "fat"],
                        additionalProperties: false,
                      },
                    },
                    required: ["id", "title", "description", "category", "time", "time_minutes", "difficulty", "diet", "servings", "ingredients", "instructions", "nutrition", "image_query"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["recipes"],
              additionalProperties: false,
            },
          },
        }],
      tool_choice: { type: "function", function: { name: "return_recipes" } },
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace Lovable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 503) {
        return new Response(JSON.stringify({ error: "A IA está temporariamente sobrecarregada. Tente novamente em alguns instantes." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(await aiRes.text());
    }

    const aiData = await aiRes.json();
    const message = aiData?.choices?.[0]?.message;
    const toolArguments = message?.tool_calls?.[0]?.function?.arguments;
    let recipes: unknown[] = [];
    if (typeof toolArguments === "string") {
      try {
        const parsed = JSON.parse(toolArguments);
        if (Array.isArray(parsed?.recipes)) recipes = parsed.recipes;
      } catch (error) {
        console.error("Invalid return_recipes arguments", error);
      }
    }
    if (recipes.length === 0) {
      const rawText = typeof message?.content === "string" ? message.content : "";
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      recipes = safeParseRecipes(cleaned);
    }
    if (recipes.length === 0) {
      return new Response(JSON.stringify({ error: "Não conseguimos interpretar a resposta da IA. Tente gerar novamente." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Fotos do Pexels: uma busca por termo, servida do cache quando possível.
    // Se algo falhar, image_url fica null e o card cai no emoji de sempre.
    const withImages = await attachImages(recipes);

    return new Response(JSON.stringify({ recipes: withImages }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
