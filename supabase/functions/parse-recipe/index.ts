import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Extrai uma receita estruturada a partir de texto colado, um arquivo de texto
// ou uma URL de site de receitas — usado pelo modal "Importar receita" em
// Minhas receitas. Reescrita do zero em 2026-09: a versão anterior estava
// publicada direto no painel do Supabase, fora do git, sem nenhuma proteção
// contra sobrecarga da IA (confirmado em teste: falhava cru num 503, sem
// tentar a chave reserva). Esta versão segue o mesmo padrão de resiliência já
// usado em generate-recipes e pantry-chat.
//
// Contrato mantido igual ao que a tela já espera (ver ImportModal em
// src/routes/minhas-receitas.tsx): body { text } OU { url }, resposta
// { recipe: {...} } em caso de sucesso ou { error: "mensagem" } em falha.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_API_KEY = Deno.env.get("AI_API_KEY") ?? "";
const AI_API_KEY_BACKUP = Deno.env.get("AI_API_KEY_BACKUP") ?? "";
const AI_URL =
  Deno.env.get("AI_GATEWAY_URL") ??
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gemini-2.5-flash";

// Mesmo padrão de generate-recipes/pantry-chat: tenta a chave reserva quando a
// principal esgota cota (429/402/403) ou o modelo está sobrecarregado (503), e
// usa timeout pra não deixar a função presa se a IA não responder.
const RETRYABLE_STATUS = [429, 402, 403, 503];
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
    console.error("parse-recipe: falha ou timeout ao chamar a IA", err);
    return new Response(null, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

async function callAI(payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const primary = await fetchAI(AI_API_KEY, body);
  if (primary.ok || !AI_API_KEY_BACKUP || !RETRYABLE_STATUS.includes(primary.status)) {
    console.log(`parse-recipe: chave principal usada (status ${primary.status})`);
    return primary;
  }
  console.warn(
    `parse-recipe: chave principal esgotada/indisponível (status ${primary.status}), tentando chave backup`,
  );
  const backup = await fetchAI(AI_API_KEY_BACKUP, body);
  console.log(`parse-recipe: chave backup usada (status ${backup.status})`);
  return backup;
}

const PAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_SOURCE_CHARS = 15_000;

/** Baixa uma página e devolve só o texto visível, sem tags/scripts/styles. */
async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ReceitaHubBot/1.0; +https://receitahub.vercel.app)",
      },
    });
    if (!res.ok) throw new Error(`site respondeu ${res.status}`);
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, MAX_SOURCE_CHARS);
  } finally {
    clearTimeout(timer);
  }
}

const systemPrompt =
  "Você é um assistente que extrai receitas culinárias de um texto (colado pelo usuário ou extraído de uma página web) e as estrutura em JSON. Responda em português do Brasil. Sempre chama a função return_recipe exatamente uma vez, mesmo que o texto tenha informação incompleta — nesse caso, faça sua melhor estimativa razoável para os campos que faltarem (ex.: tempo e dificuldade) em vez de inventar um prato diferente do que está no texto. O modo de preparo deve ser uma única string com os passos numerados separados por quebras de linha.";

const recipeSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string", description: "ex.: prato principal, massa, salada, sobremesa, pães, sopa, lanche" },
    time_minutes: { type: "number" },
    difficulty: { type: "string", description: "fácil, médio ou difícil" },
    diet: { type: "array", items: { type: "string" } },
    ingredients: { type: "array", items: { type: "string" } },
    instructions: { type: "string" },
    calories_per_serving: { type: "number" },
    cost_home_brl: { type: "number" },
    cost_delivery_brl: { type: "number" },
  },
  required: ["title", "description", "category", "time_minutes", "difficulty", "diet", "ingredients", "instructions"],
  additionalProperties: false,
};

// Resposta pode vir truncada; se o parse direto falhar, tenta recuperar só o
// primeiro objeto completo do texto (mesma técnica usada em generate-recipes).
function safeParseRecipe(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (_) {
    // segue para o modo de recuperação
  }
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") { depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch (_) {
          return null;
        }
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

    let sourceText = rawText;
    if (!sourceText && rawUrl) {
      try {
        sourceText = await fetchPageText(rawUrl);
      } catch (err) {
        console.error("parse-recipe: falha ao buscar a URL", err);
        return new Response(
          JSON.stringify({ error: "Não conseguimos acessar essa página. Tente colar o texto da receita diretamente." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!sourceText) {
      return new Response(
        JSON.stringify({ error: "Cole o texto da receita ou uma URL válida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    sourceText = sourceText.slice(0, MAX_SOURCE_CHARS);

    const userPrompt = rawUrl
      ? `Extraia a receita do texto abaixo, extraído da página ${rawUrl}:\n\n${sourceText}`
      : `Extraia a receita do texto abaixo:\n\n${sourceText}`;

    const aiRes = await callAI({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      tools: [{
        type: "function",
        function: {
          name: "return_recipe",
          description: "Retorna a receita extraída, estruturada",
          parameters: recipeSchema,
        },
      }],
      tool_choice: { type: "function", function: { name: "return_recipe" } },
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 503) {
        return new Response(JSON.stringify({ error: "A IA está temporariamente sobrecarregada. Tente novamente em alguns instantes." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiRes.text().catch(() => "");
      console.error("parse-recipe: erro da IA", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Não conseguimos processar a receita agora. Tente novamente." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const message = aiData?.choices?.[0]?.message;
    const toolArguments = message?.tool_calls?.[0]?.function?.arguments;

    let recipe: Record<string, unknown> | null = null;
    if (typeof toolArguments === "string") {
      try {
        recipe = JSON.parse(toolArguments);
      } catch (error) {
        console.error("parse-recipe: return_recipe arguments inválidos", error);
      }
    }
    if (!recipe) {
      const rawContent = typeof message?.content === "string" ? message.content : "";
      const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      recipe = safeParseRecipe(cleaned);
    }

    if (!recipe || !recipe.title) {
      return new Response(JSON.stringify({ error: "Não conseguimos interpretar essa receita. Tente colar o texto diretamente." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ recipe }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("parse-recipe: erro inesperado", err);
    return new Response(JSON.stringify({ error: "Não conseguimos importar essa receita agora. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
