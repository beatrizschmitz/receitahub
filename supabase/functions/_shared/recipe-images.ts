// Resolve fotos de receita no Pexels, com cache em public.recipe_images.
//
// O cache é chaveado pelo termo de busca normalizado. Isso importa porque o
// plano gratuito do Pexels permite 200 requisições por hora: com 6 receitas por
// geração, sem cache o app inteiro estouraria em ~33 gerações/hora.
//
// Segue o padrão das outras functions do projeto: PostgREST via fetch, sem
// supabase-js.

export type RecipeImage = {
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
export function normalizeQuery(raw: string): string {
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
export async function resolveRecipeImages(
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
