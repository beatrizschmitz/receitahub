import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/landing-hero.jpg";
import stepImg from "@/assets/landing-step.jpg";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { recipes as catalogRecipes } from "@/data/recipes";
import { RecipeCover, RecipePhotoCredit } from "@/components/RecipeCover";
import { OG_IMAGE_URL } from "@/lib/site";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "receitahub — cozinhe com o que você já tem" },
      { name: "description", content: "IA que transforma os ingredientes da sua despensa em receitas reais. Menos desperdício, mais sabor." },
      { property: "og:title", content: "receitahub — cozinhe com o que você já tem" },
      { property: "og:image", content: OG_IMAGE_URL },
    ],
  }),
});

const steps = [
  { n: "01", title: "Cadastre sua despensa", text: "Adicione o que você tem em casa em segundos — manualmente ou por foto da prateleira." },
  { n: "02", title: "A IA monta o cardápio", text: "Receitas reais, em português, calculadas a partir dos seus ingredientes e preferências alimentares." },
  { n: "03", title: "Cozinhe sem sobras", text: "Ajuste porções, substitua ingredientes e marque o que já usou. A despensa atualiza sozinha." },
];

type FeaturedRecipe = {
  id: string; title: string; category: string; time_minutes: number | null;
  description: string | null; ingredients: string[] | null; instructions: string | null;
  difficulty: string | null; diet: string[] | null; servings?: number;
  // Vêm do generate-recipes (Pexels) ou de user_recipes; null cai no emoji.
  image_url?: string | null;
  image_photographer?: string | null;
  image_photographer_url?: string | null;
};

// Catálogo curado local: último recurso quando não há receitas salvas nem IA disponível
const FALLBACK_FEATURED: FeaturedRecipe[] = catalogRecipes.slice(0, 6).map((r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  time_minutes: r.time,
  description: r.description,
  ingredients: r.ingredients ?? null,
  instructions: r.instructions ?? null,
  difficulty: r.difficulty,
  diet: r.diet,
  image_url: r.image,
}));

// Mini modal para receitas em destaque
function FeaturedModal({ recipe, onClose }: { recipe: FeaturedRecipe; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 bg-charcoal border border-border rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <RecipeCover
          title={recipe.title} category={recipe.category} ingredients={recipe.ingredients}
          imageUrl={recipe.image_url} className="h-48 rounded-t-3xl" emoji="solo"
        >
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-charcoal/80 text-cream hover:bg-charcoal transition text-lg">×</button>
          <div className="absolute bottom-4 left-6">
            <div className="flex flex-wrap gap-2 mb-1">
              {recipe.diet?.map((d) => <span key={d} className="text-[10px] uppercase tracking-wider bg-blush/20 text-blush px-2 py-0.5 rounded-full">{d}</span>)}
            </div>
            <h2 className="font-display text-2xl text-cream leading-tight drop-shadow-lg">{recipe.title}</h2>
          </div>
        </RecipeCover>
        <div className="p-6 space-y-5">
          <div className="flex gap-4 text-sm text-cream/60">
            {recipe.time_minutes && <span>⏱ {recipe.time_minutes} min</span>}
            {recipe.difficulty && <span>📊 {recipe.difficulty}</span>}
            <span>🍽 {recipe.category}</span>
          </div>
          {recipe.description && <p className="text-cream/70 text-sm leading-relaxed">{recipe.description}</p>}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-blush mb-3">Ingredientes</h3>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-cream/80">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blush/60 flex-shrink-0" />{ing}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recipe.instructions && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-blush mb-3">Modo de preparo</h3>
              <div className="text-sm text-cream/80 leading-relaxed space-y-2">
                {recipe.instructions.split("\n").map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </div>
          )}
          <Link to="/receitas" onClick={onClose} className="block w-full py-3 rounded-full bg-blush text-charcoal text-sm font-medium text-center hover:bg-blush-deep transition">
            Ver mais receitas →
          </Link>
          <RecipePhotoCredit imageUrl={recipe.image_url} photographer={recipe.image_photographer} photographerUrl={recipe.image_photographer_url} className="text-center" />
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const { session } = useAuth();
  const [pantryCount, setPantryCount] = useState<number | null>(null);
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [featured, setFeatured] = useState<FeaturedRecipe[]>([]);
  const [selectedFeatured, setSelectedFeatured] = useState<FeaturedRecipe | null>(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // Conta itens reais da despensa
  useEffect(() => {
    if (!session) { setPantryCount(null); setRecipeCount(null); return; }
    void (async () => {
      const [{ count: pantry }, { count: recipes }] = await Promise.all([
        supabase.from("pantry_items").select("*", { count: "exact", head: true }).eq("user_id", session.user.id),
        supabase.from("user_recipes").select("*", { count: "exact", head: true }).eq("user_id", session.user.id),
      ]);
      setPantryCount(pantry ?? 0);
      setRecipeCount(recipes ?? 0);
    })();
  }, [session]);

  // Receitas em destaque, em cascata: as salvas do usuário -> IA -> catálogo local.
  // O catálogo garante que a landing nunca renderize vazia, mesmo sem login,
  // sem rede ou sem créditos de IA (visitante anônimo não enxerga user_recipes por RLS).
  useEffect(() => {
    void (async () => {
      setLoadingFeatured(true);
      try {
        const { data, error } = await supabase
          .from("user_recipes")
          .select(
            "id, title, category, time_minutes, description, ingredients, instructions, difficulty, diet, image_url, image_photographer, image_photographer_url",
          )
          .order("created_at", { ascending: false })
          .limit(6);
        if (error) console.error("destaques: user_recipes", error);

        if (data && data.length >= 3) {
          setFeatured(
            data.map((r) => ({
              id: r.id,
              title: r.title,
              category: r.category ?? "",
              time_minutes: r.time_minutes ?? 0,
              description: r.description ?? "",
              ingredients: r.ingredients ?? [],
              instructions: r.instructions ?? "",
              difficulty: r.difficulty ?? "",
              diet: r.diet ?? [],
              image_url: r.image_url,
              image_photographer: r.image_photographer,
              image_photographer_url: r.image_photographer_url,
            })),
          );
          return;
        }

        const { data: aiData, error: aiError } = await supabase.functions.invoke(
          "generate-recipes",
          {
            body: {
              category: "todas",
              diet: [],
              ingredients: [],
              search: "",
              seed: "destaque-fixo",
            },
          },
        );
        // Falha comum aqui: 402 quando os créditos de IA acabam
        if (aiError) console.error("destaques: generate-recipes", aiError);

        const aiRecipes = (aiData?.recipes ?? []) as FeaturedRecipe[];
        setFeatured(aiRecipes.length > 0 ? aiRecipes.slice(0, 6) : FALLBACK_FEATURED);
      } catch (err) {
        console.error("destaques", err);
        setFeatured(FALLBACK_FEATURED);
      } finally {
        setLoadingFeatured(false);
      }
    })();
  }, []);

  const firstName = session?.user?.user_metadata?.full_name?.split(" ")?.[0];

  return (
    <div className="min-h-screen bg-charcoal text-cream overflow-x-hidden">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap" />

      {/* HERO */}
      <section className="relative">
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] bg-blush/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20 grid lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-6 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blush/30 bg-blush/5 text-xs text-blush">
              <span className="h-1.5 w-1.5 rounded-full bg-blush animate-pulse" />
              cozinha inteligente, em português
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl leading-[1.02] text-cream">
              {firstName ? `Olá, ${firstName}! Cozinhe` : "Cozinhe"} com o que{" "}
              <em className="font-display italic text-blush">você já tem</em> em casa.
            </h1>
            <p className="text-lg text-cream/70 max-w-xl leading-relaxed">
              O receitahub usa inteligência artificial para transformar a sua despensa em receitas reais, prontas em minutos. Sem listas de mercado, sem desperdício.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/receitas" className="group inline-flex items-center gap-2 bg-blush text-charcoal px-7 py-4 rounded-full font-medium hover:bg-blush-deep transition">
                ver receitas de hoje
                <svg className="h-4 w-4 transition group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </Link>
              <Link to="/minha-despensa" className="inline-flex items-center gap-2 px-7 py-4 rounded-full border border-border text-cream/80 hover:border-blush/40 hover:text-cream transition">
                cadastrar despensa
              </Link>
            </div>
            <div className="flex items-center gap-8 pt-6 text-sm text-cream/60">
              <div>
                <div className="font-display text-2xl text-blush">∞</div>
                <div>receitas via IA</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="font-display text-2xl text-blush">3 min</div>
                <div>para o seu primeiro prato</div>
              </div>
              <div className="hidden sm:block h-10 w-px bg-border" />
              <div className="hidden sm:block">
                <div className="font-display text-2xl text-blush">-40%</div>
                <div>desperdício de comida</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-border">
              <img src={heroImg} alt="Ingredientes frescos sobre tábua de ardósia" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-tr from-charcoal/40 via-transparent to-transparent" />
            </div>

            {/* Card dinâmico — só aparece se o usuário estiver logado e tiver itens na despensa */}
            {session && pantryCount !== null && pantryCount > 0 && (
              <div className="absolute -bottom-6 -left-6 bg-charcoal-light/95 backdrop-blur-xl border border-border rounded-2xl p-5 max-w-xs shadow-2xl">
                <div className="flex items-center gap-2 text-xs text-blush mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blush animate-pulse" />
                  IA sugerindo agora
                </div>
                <div className="font-display text-lg text-cream leading-tight">
                  Você tem <span className="text-blush">{pantryCount} itens</span> na despensa
                  {recipeCount !== null && recipeCount > 0 && ` e ${recipeCount} receita${recipeCount !== 1 ? "s" : ""} salva${recipeCount !== 1 ? "s" : ""}`}.
                </div>
              </div>
            )}

            {/* Card para visitantes */}
            {!session && (
              <div className="absolute -bottom-6 -left-6 bg-charcoal-light/95 backdrop-blur-xl border border-border rounded-2xl p-5 max-w-xs shadow-2xl">
                <div className="flex items-center gap-2 text-xs text-blush mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blush animate-pulse" />
                  IA sugerindo agora
                </div>
                <div className="font-display text-lg text-cream leading-tight">
                  Crie uma conta e descubra quantas receitas cabem na sua despensa.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-border bg-charcoal-light/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="max-w-2xl mb-16">
            <div className="text-xs uppercase tracking-[0.2em] text-blush mb-4">como funciona</div>
            <h2 className="text-4xl md:text-5xl text-cream leading-tight">
              Da despensa ao prato em <em className="font-display italic text-blush">três passos</em>.
            </h2>
          </div>
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 relative">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-border">
                <img src={stepImg} alt="Despensa organizada com potes de vidro" loading="lazy" className="w-full h-full object-cover" />
              </div>
            </div>
            <ol className="lg:col-span-7 space-y-2">
              {steps.map((s) => (
                <li key={s.n} className="group grid grid-cols-[auto_1fr] gap-6 items-start py-8 border-b border-border last:border-b-0">
                  <span className="font-display italic text-5xl text-blush/70 group-hover:text-blush transition">{s.n}</span>
                  <div>
                    <h3 className="text-2xl text-cream mb-2">{s.title}</h3>
                    <p className="text-cream/65 leading-relaxed max-w-lg">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* FEATURED RECIPES — clicáveis! */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between mb-12 gap-6 flex-wrap">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.2em] text-blush mb-4">em destaque</div>
            <h2 className="text-4xl md:text-5xl text-cream leading-tight">
              Receitas <em className="font-display italic text-blush">desta semana</em>.
            </h2>
            <p className="mt-3 text-cream/60 text-sm">Clique em qualquer receita para ver os detalhes.</p>
          </div>
          <Link to="/receitas" className="inline-flex items-center gap-2 text-cream/80 hover:text-blush transition text-sm border-b border-border hover:border-blush pb-1">
            ver todas as receitas
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/5] rounded-2xl bg-charcoal-light border border-border animate-pulse" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {featured.map((r, i) => {
              return (
                <button key={r.id} onClick={() => setSelectedFeatured(r)} className="group text-left block w-full">
                  <RecipeCover
                    title={r.title} category={r.category} ingredients={r.ingredients}
                    imageUrl={r.image_url} emoji="solo"
                    className="aspect-[4/5] rounded-2xl mb-4 border border-border group-hover:border-blush/40 transition"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 font-display italic text-cream/80 text-sm">nº {String(i + 1).padStart(2, "0")}</span>
                    <div className="absolute bottom-4 left-4 right-4">
                      {r.diet && r.diet.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {r.diet.slice(0, 2).map((d) => <span key={d} className="text-[9px] uppercase tracking-wider bg-blush/20 text-blush px-2 py-0.5 rounded-full">{d}</span>)}
                        </div>
                      )}
                    </div>
                  </RecipeCover>
                  <div className="text-xs uppercase tracking-widest text-blush/90 mb-1.5">
                    {r.category}{r.time_minutes ? ` · ${r.time_minutes} min` : ""}
                  </div>
                  <h3 className="font-display text-2xl text-cream group-hover:text-blush transition leading-tight">{r.title}</h3>
                  {r.description && <p className="text-sm text-cream/60 mt-1 line-clamp-2">{r.description}</p>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
          <div className="inline-block">
            <div className="text-xs uppercase tracking-[0.2em] text-blush mb-6">comece agora</div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl text-cream leading-[1.05] max-w-4xl mx-auto">
              O que tem na sua <em className="font-display italic text-blush">despensa</em> hoje?
            </h2>
            <p className="mt-6 text-lg text-cream/70 max-w-xl mx-auto">
              Em menos de 3 minutos a IA descobre tudo que você pode cozinhar — sem precisar ir ao mercado.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link to="/minha-despensa" className="group inline-flex items-center gap-2 bg-blush text-charcoal px-8 py-4 rounded-full font-medium hover:bg-blush-deep transition">
                cadastrar minha despensa
                <svg className="h-4 w-4 transition group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </Link>
              <Link to="/receitas" className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-border text-cream/80 hover:border-blush/40 hover:text-cream transition">
                explorar receitas primeiro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-cream/50">
          <div className="font-display italic text-blush text-lg font-mono">receitahub</div>
          <div>© {new Date().getFullYear()} receitahub. cozinhe com inteligência.</div>
        </div>
      </footer>

      {selectedFeatured && <FeaturedModal recipe={selectedFeatured} onClose={() => setSelectedFeatured(null)} />}
    </div>
  );
}
