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

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ReceitaHubBot/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Falha ao buscar URL (${res.status})`);
  const html = await res.text();
  // Strip scripts/styles, then tags
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 12000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { text = "", url = "" } = body as { text?: string; url?: string };

    let source = text?.trim() ?? "";
    if (!source && url) {
      source = await fetchUrlText(url);
    }
    if (!source) {
      return new Response(JSON.stringify({ error: "Envie 'text' ou 'url'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "Você extrai receitas de textos brutos (colados ou raspados de sites) e devolve JSON estruturado em português do Brasil. Responda APENAS com JSON válido, sem markdown.";
    const userPrompt = `Extraia a receita do conteúdo abaixo. Identifique título, descrição curta, categoria (entrada/prato principal/sobremesa/bebida/lanche/café da manhã), tempo total em minutos, dificuldade (fácil/médio/difícil), restrições (ex: vegano, vegetariano, sem glúten, sem lactose), ingredientes (lista) e modo de preparo (texto numerado com quebras de linha).

Conteúdo:
"""
${source}
"""

Inclua também:
- calories_per_serving: número inteiro em kcal por porção (null se não der pra estimar).
- cost_home_brl: estimativa em reais (R$) do custo TOTAL dos ingredientes pra fazer a receita em casa, no Brasil (ex: 18.50). Considere preços médios de supermercado brasileiro em 2025.
- cost_delivery_brl: estimativa em reais (R$) de quanto custaria pedir essa receita pronta via delivery (iFood/Rappi) no Brasil (ex: 45.00). Costuma ser 2-3x o custo caseiro.

Responda APENAS no formato JSON: {"recipe":{"title":"","description":"","category":"prato principal","time_minutes":30,"difficulty":"fácil","diet":[],"calories_per_serving":350,"cost_home_brl":18.50,"cost_delivery_brl":45.00,"ingredients":["..."],"instructions":"1. ...\\n2. ..."}}`;

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
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(await aiRes.text());
    }

    const aiData = await aiRes.json();
    const rawText = aiData?.choices?.[0]?.message?.content ?? "";
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const recipe = parsed.recipe ?? parsed;
    return new Response(JSON.stringify({ recipe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
