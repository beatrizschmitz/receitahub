import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const AI_API_KEY = Deno.env.get("AI_API_KEY") ?? "";
// Gateway de IA compatível com a API OpenAI (/v1/chat/completions).
// Trocar de provedor é só mudar estas variáveis de ambiente — nenhum código muda.
// Padrão: Google AI Studio, que mantém os mesmos modelos Gemini usados antes.
const AI_URL =
  Deno.env.get("AI_GATEWAY_URL") ??
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gemini-2.5-flash";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { category = "todas", diet = [], ingredients = [], search = "", seed = "" } = body;
    const categoryPart = category && category !== "todas" ? `na categoria "${category}"` : "de qualquer categoria";
    const dietPart = diet.length > 0 ? `As receitas devem ser: ${diet.join(", ")}.` : "";
    const ingredientsPart = ingredients.length > 0 ? `Use preferencialmente estes ingredientes: ${ingredients.join(", ")}.` : "";
    const searchPart = search ? `O usuário busca por: "${search}".` : "";
    const variationSeed = seed || Math.random().toString(36).slice(2);
    const inspirations = ["nordestina", "mineira", "paulista", "gaúcha", "baiana", "amazônica", "italiana abrasileirada", "japonesa abrasileirada", "árabe abrasileirada", "portuguesa", "caipira", "contemporânea", "vegetariana criativa", "comfort food", "de boteco", "de festa", "de domingo em família", "saudável", "low carb", "rápida do dia a dia"];
    const picks = [...inspirations].sort(() => Math.random() - 0.5).slice(0, 3).join(", ");
    const variationPart = `Surpreenda com receitas variadas e criativas — evite os clássicos óbvios. Inspire-se em estilos como: ${picks}. Token de variação (use para diversificar, não cite): ${variationSeed}.`;
    const systemPrompt = "Você é um chef brasileiro especialista e criativo. Sempre varia as sugestões e chama a função return_recipes exatamente uma vez. Responda em português do Brasil. O modo de preparo deve ser uma única string com até 5 passos numerados separados por quebras de linha.";
    const userPrompt = `Gere exatamente 6 receitas ${categoryPart}. ${dietPart} ${ingredientsPart} ${searchPart} ${variationPart}`;

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
                    required: ["id", "title", "description", "category", "time", "time_minutes", "difficulty", "diet", "servings", "ingredients", "instructions", "nutrition"],
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
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace Lovable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    return new Response(JSON.stringify({ recipes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
