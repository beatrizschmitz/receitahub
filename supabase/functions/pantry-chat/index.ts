// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Gateway de IA compatível com a API OpenAI (/v1/chat/completions).
// Trocar de provedor é só mudar estas variáveis de ambiente — nenhum código muda.
// Padrão: Google AI Studio, que mantém os mesmos modelos Gemini usados antes.
const AI_URL =
  Deno.env.get("AI_GATEWAY_URL") ??
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gemini-2.5-flash";

// Fallback de chave de IA — duplicado em generate-recipes/index.ts (mesma
// lógica, só muda o nome da função no log). Ver nota do painel no topo do
// arquivo: cada function é auto-contida, então isso não vira um _shared/.
// Quando a chave principal esgota cota (429/402/403), tenta a chave reserva
// antes de desistir. AI_API_KEY_BACKUP é opcional — sem ela, só a principal roda.
async function callAI(
  payload: unknown,
  apiKey: string,
  backupKey: string,
): Promise<Response> {
  const body = JSON.stringify(payload);
  const primary = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body,
  });
  if (primary.ok || !backupKey || ![429, 402, 403].includes(primary.status)) {
    console.log(`pantry-chat: chave principal usada (status ${primary.status})`);
    return primary;
  }
  console.warn(
    `pantry-chat: chave principal esgotada (status ${primary.status}), tentando chave backup`,
  );
  const backup = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${backupKey}`, "Content-Type": "application/json" },
    body,
  });
  console.log(`pantry-chat: chave backup usada (status ${backup.status})`);
  return backup;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, pantry } = await req.json();
    const AI_API_KEY = Deno.env.get("AI_API_KEY");
    if (!AI_API_KEY) throw new Error("AI_API_KEY não configurada");
    const AI_API_KEY_BACKUP = Deno.env.get("AI_API_KEY_BACKUP") ?? "";

    // Validação server-side do limite diário do plano gratuito
    const FREE_CHAT_DAILY_LIMIT = 10;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (token && token !== anonKey) {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      });
      if (userRes.ok) {
        const user = await userRes.json();
        const rest = async (path: string) =>
          fetch(`${supabaseUrl}/rest/v1/${path}`, {
            headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
          }).then((r) => (r.ok ? r.json() : []));
        const today = new Date().toISOString().slice(0, 10);
        const [subs, usage] = await Promise.all([
          rest(
            `subscriptions?user_id=eq.${user.id}&select=plan_tier,status,current_period_end`,
          ),
          rest(
            `chat_usage?user_id=eq.${user.id}&reference_date=eq.${today}&select=message_count`,
          ),
        ]);
        const sub = subs?.[0];
        // Mesma regra de src/lib/plans.ts (effectiveTier): uma assinatura
        // cancelada continua valendo até o fim do período já pago.
        const withinPaidPeriod =
          sub?.current_period_end && new Date(sub.current_period_end) > new Date();
        const tier =
          sub && (sub.status === "active" || (sub.status === "canceled" && withinPaidPeriod))
            ? sub.plan_tier
            : "free";
        const used = usage?.[0]?.message_count ?? 0;
        if (tier === "free" && used > FREE_CHAT_DAILY_LIMIT) {
          return new Response(
            JSON.stringify({
              error: `Limite diário de ${FREE_CHAT_DAILY_LIMIT} mensagens do plano gratuito atingido.`,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    const pantryList =
      Array.isArray(pantry) && pantry.length
        ? pantry
            .map(
              (p: any) =>
                `- ${p.name}${p.quantity ? ` (${p.quantity})` : ""}${
                  p.category ? ` [${p.category}]` : ""
                }`
            )
            .join("\n")
        : "(despensa vazia ou usuário não logado)";

    const systemPrompt = `Você é um chef brasileiro simpático e criativo, especialista em aproveitar ingredientes da despensa para sugerir receitas. Responda SEMPRE em português do Brasil, de forma direta, amigável e com emojis quando fizer sentido.

DESPENSA ATUAL DO USUÁRIO:
${pantryList}

Regras:
- Sugira receitas que possam ser feitas COM OS INGREDIENTES DA DESPENSA acima sempre que possível.
- Se faltar 1 ou 2 ingredientes essenciais, mencione claramente o que precisa comprar.
- Se a despensa estiver vazia, peça gentilmente para o usuário cadastrar itens em "Minha Despensa".
- Mantenha respostas concisas (no máximo ~300 palavras), use markdown leve (negrito, listas).
- Sempre que sugerir uma receita completa (não uma ideia rápida), use exatamente esta estrutura, nesta ordem, e NUNCA omita a lista de ingredientes:
  1. Nome da receita em negrito, seguido de tempo aproximado e dificuldade em uma linha.
  2. Uma linha "**Ingredientes**" seguida de uma lista com marcadores, um ingrediente por linha, cada um com quantidade (ex.: "- 2 xícaras de arroz", "- 1 cebola picada").
  3. Uma linha "**Modo de preparo**" seguida do passo a passo numerado.
  4. Duas linhas finais:
     - "**Calorias:** ~320 kcal/porção"
     - "**Custo:** ~R$ 18 em casa vs ~R$ 45 no delivery" (estimativa em reais; delivery costuma ser 2-3x o caseiro).`;

    const response = await callAI(
      {
        model: AI_MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...(Array.isArray(messages) ? messages : []),
        ],
      },
      AI_API_KEY,
      AI_API_KEY_BACKUP,
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pantry-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
