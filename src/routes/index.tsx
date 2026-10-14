import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import heroImg from "@/assets/landing-hero.jpg";
import stepImg from "@/assets/landing-step.jpg";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NutritionCard } from "@/components/NutritionCard";
import { useRecipeNutrition } from "@/hooks/use-recipe-nutrition";
import { insertUserRecipe } from "@/lib/user-recipes";
import { useAuth } from "@/contexts/AuthContext";
import { recipes as catalogRecipes } from "@/data/recipes";
import { Clock, Gauge, Utensils } from "lucide-react";
import { RecipeCover, RecipePhotoCredit } from "@/components/RecipeCover";
import { OG_IMAGE_URL } from "@/lib/site";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "receitahub — cozinhe com o que você já tem" },
      {
        name: "description",
        content:
          "IA que transforma os ingredientes da sua despensa em receitas reais. Menos desperdício, mais sabor.",
      },
      { property: "og:title", content: "receitahub — cozinhe com o que você já tem" },
      { property: "og:image", content: OG_IMAGE_URL },
    ],
  }),
});

const steps = [
  {
    n: "01",
    title: "Cadastre sua despensa",
    text: "Adicione o que você tem em casa em segundos — manualmente ou por foto da prateleira.",
  },
  {
    n: "02",
    title: "A IA monta o cardápio",
    text: "Receitas reais, em português, calculadas a partir dos seus ingredientes e preferências alimentares.",
  },
  {
    n: "03",
    title: "Cozinhe sem sobras",
    text: "Ajuste porções, substitua ingredientes e marque o que já usou. A despensa atualiza sozinha.",
  },
];

type FeaturedRecipe = {
  id: string;
  title: string;
  category: string;
  time_minutes: number | null;
  description: string | null;
  ingredients: string[] | null;
  instructions: string | null;
  difficulty: string | null;
  diet: string[] | null;
  servings?: number;
  // Vêm do generate-recipes (Pexels) ou de user_recipes; null cai no emoji.
  image_url?: string | null;
  image_photographer?: string | null;
  image_photographer_url?: string | null;
  // A IA já devolve isso (ver generate-recipes), só não era usado nesta página.
  nutrition?: { calories: number; protein: number; carbs: number; fat: number };
  cost_home_brl?: number | null;
  cost_delivery_brl?: number | null;
};

// Catálogo curado local: último recurso quando não há receitas salvas nem IA disponível
const FALLBACK_FEATURED: FeaturedRecipe[] = catalogRecipes.slice(0, 5).map((r) => ({
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
  servings: r.servings,
  nutrition: r.nutrition,
}));

// Cache dos destaques. Sem ele a home dispara uma geração por IA a cada visita
// de cada visitante, o que queima a cota gratuita em pouco tempo. 7 dias faz a
// "receita da semana" ser literal: as mesmas receitas ficam a semana toda,
// até o próximo ciclo ou até alguém clicar em "Gerar novas".
const FEATURED_CACHE_KEY = "receitahub:featured";
const FEATURED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type FeaturedCache = { at: number; recipes: FeaturedRecipe[] };

// localStorage não existe no SSR e pode lançar em aba anônima ou com storage
// bloqueado — em qualquer falha o cache simplesmente não existe.
function readFeaturedCache(): FeaturedRecipe[] | null {
  try {
    const raw = localStorage.getItem(FEATURED_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as FeaturedCache;
    if (!Array.isArray(cached?.recipes) || cached.recipes.length === 0) return null;
    if (Date.now() - cached.at > FEATURED_TTL_MS) return null;
    return cached.recipes;
  } catch {
    return null;
  }
}

function writeFeaturedCache(recipes: FeaturedRecipe[]) {
  try {
    localStorage.setItem(
      FEATURED_CACHE_KEY,
      JSON.stringify({ at: Date.now(), recipes } satisfies FeaturedCache),
    );
  } catch {
    // storage cheio ou bloqueado: seguir sem cache é aceitável
  }
}

// Mini modal para receitas em destaque
function FeaturedModal({
  recipe,
  onClose,
  onSave,
  saving,
  saved,
}: {
  recipe: FeaturedRecipe;
  onClose: () => void;
  onSave: (r: FeaturedRecipe) => void;
  saving: boolean;
  saved: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const { session: modalSession } = useAuth();
  const { nutrition, status, retry } = useRecipeNutrition({
    title: recipe.title,
    ingredients: recipe.ingredients,
    servings: recipe.servings ?? 4,
    initial: recipe.nutrition,
    canEstimate: Boolean(modalSession),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="featured-modal-title"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-charcoal border border-border rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <RecipeCover
          title={recipe.title}
          category={recipe.category}
          ingredients={recipe.ingredients}
          imageUrl={recipe.image_url}
          className="h-48 rounded-t-3xl"
          variant="solo"
        >
          {/* Sempre escuro, nos dois temas: a função aqui não é seguir a paleta e sim
              garantir que o texto leia por cima de uma foto qualquer. */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-charcoal/80 text-cream hover:bg-charcoal transition text-lg"
          >
            ×
          </button>
          <div className="absolute bottom-4 left-6">
            <div className="flex flex-wrap gap-2 mb-1">
              {recipe.diet?.map((d) => (
                <span
                  key={d}
                  className="text-[10px] uppercase tracking-wider bg-blush/20 text-blush px-2 py-0.5 rounded-full"
                >
                  {d}
                </span>
              ))}
            </div>
            <h2
              id="featured-modal-title"
              className="font-display text-2xl text-cream leading-tight drop-shadow-lg"
            >
              {recipe.title}
            </h2>
          </div>
        </RecipeCover>
        <div className="p-6 space-y-5">
          <div className="flex gap-4 text-sm text-cream/60">
            {recipe.time_minutes && <span>{recipe.time_minutes} min</span>}
            {recipe.difficulty && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge size={14} strokeWidth={1.5} />
                {recipe.difficulty}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Utensils size={14} strokeWidth={1.5} />
              {recipe.category}
            </span>
          </div>
          {recipe.description && (
            <p className="text-cream/70 text-sm leading-relaxed">{recipe.description}</p>
          )}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-cream/80 mb-3">Ingredientes</h3>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-cream/80">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blush/60 flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recipe.instructions && (
            <div>
              <h3 className="text-sm font-medium text-cream/80 mb-3">Modo de preparo</h3>
              <div className="text-sm text-cream/80 leading-relaxed space-y-2">
                {recipe.instructions.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}
          <NutritionCard nutrition={nutrition} status={status} onRetry={retry} />
          <button
            onClick={() => onSave(recipe)}
            disabled={saving || saved}
            className={`w-full py-3 rounded-full text-sm font-medium transition ${saved ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-default" : "bg-blush text-charcoal hover:bg-blush-deep disabled:opacity-60"}`}
          >
            {saved
              ? "Salva em minhas receitas"
              : saving
                ? "Salvando…"
                : "Salvar em minhas receitas"}
          </button>
          <Link
            to="/receitas"
            onClick={onClose}
            className="block w-full py-3 rounded-full border border-border text-cream/80 text-sm font-medium text-center hover:border-blush/40 hover:text-cream transition"
          >
            Ver mais receitas
          </Link>
          <RecipePhotoCredit
            imageUrl={recipe.image_url}
            photographer={recipe.image_photographer}
            photographerUrl={recipe.image_photographer_url}
            className="text-center"
          />
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [pantryCount, setPantryCount] = useState<number | null>(null);
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [featured, setFeatured] = useState<FeaturedRecipe[]>([]);
  const [selectedFeatured, setSelectedFeatured] = useState<FeaturedRecipe | null>(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [savingFeaturedId, setSavingFeaturedId] = useState<string | null>(null);
  const [savedFeaturedIds, setSavedFeaturedIds] = useState<Set<string>>(new Set());

  // Mesma lógica de /receitas (handleSave em receitas.tsx): visitante é
  // mandado pro cadastro em vez de a ação falhar caladinha.
  async function handleSaveFeatured(recipe: FeaturedRecipe) {
    if (!session) {
      navigate({ to: "/cadastro" });
      return;
    }
    setSavingFeaturedId(recipe.id);
    try {
      const { error } = await insertUserRecipe({
        user_id: session.user.id,
        title: recipe.title,
        description: recipe.description,
        category: recipe.category,
        time_minutes: recipe.time_minutes,
        difficulty: recipe.difficulty,
        diet: recipe.diet,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        calories_per_serving: recipe.nutrition?.calories ?? null,
        nutrition: recipe.nutrition ?? null,
        is_favorite: false,
        image_url: recipe.image_url ?? null,
        image_photographer: recipe.image_photographer ?? null,
        image_photographer_url: recipe.image_photographer_url ?? null,
        cost_home_brl: recipe.cost_home_brl ?? null,
        cost_delivery_brl: recipe.cost_delivery_brl ?? null,
      });
      if (!error) {
        setSavedFeaturedIds((prev) => new Set(prev).add(recipe.id));
      } else {
        console.error(error);
        toast.error("Não consegui salvar a receita. Tente novamente.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Não consegui salvar a receita. Tente novamente.");
    } finally {
      setSavingFeaturedId(null);
    }
  }

  // Conta itens reais da despensa
  useEffect(() => {
    if (!session) {
      setPantryCount(null);
      setRecipeCount(null);
      return;
    }
    void (async () => {
      const [{ count: pantry }, { count: recipes }] = await Promise.all([
        supabase
          .from("pantry_items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id),
        supabase
          .from("user_recipes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id),
      ]);
      setPantryCount(pantry ?? 0);
      setRecipeCount(recipes ?? 0);
    })();
  }, [session]);

  // Receitas em destaque, em cascata: cache semanal -> IA -> catálogo.
  // Sempre as mesmas sugestões pra todo mundo (logado ou não) — não são as
  // receitas salvas de ninguém, isso é "minhas receitas" em outra página.
  // O catálogo garante que a landing nunca renderize vazia, mesmo sem login,
  // sem rede ou sem créditos de IA.
  //
  // force = true pula o cache e vai direto na IA. É o caminho do botão
  // "gerar novas", uma ação explícita de quem está na tela.
  const loadFeatured = useCallback(async (force = false) => {
    setLoadingFeatured(true);
    try {
      if (!force) {
        const cached = readFeaturedCache();
        if (cached) {
          setFeatured(cached);
          return;
        }
      }

      const { data: aiData, error: aiError } = await supabase.functions.invoke("generate-recipes", {
        body: {
          category: "todas",
          diet: [],
          ingredients: [],
          search: "",
          // Semente fixa no carregamento automático mantém a seção estável
          // entre visitas; no "gerar novas" ela varia, senão a IA tenderia a
          // devolver as mesmas receitas.
          seed: force ? Math.random().toString(36).slice(2) : "destaque-fixo",
        },
      });
      // Falha comum aqui: 402 quando os créditos de IA acabam
      if (aiError) console.error("destaques: generate-recipes", aiError);

      const aiRecipes = (aiData?.recipes ?? []) as FeaturedRecipe[];
      if (aiRecipes.length > 0) {
        const next = aiRecipes.slice(0, 5);
        setFeatured(next);
        // Só o resultado da IA vai para o cache. O catálogo local é fallback de
        // erro e não deve congelar a seção por 6 horas.
        writeFeaturedCache(next);
      } else {
        setFeatured(FALLBACK_FEATURED);
      }
    } catch (err) {
      console.error("destaques", err);
      setFeatured(FALLBACK_FEATURED);
    } finally {
      setLoadingFeatured(false);
    }
  }, []);

  useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  const firstName = session?.user?.user_metadata?.full_name?.split(" ")?.[0];

  return (
    <div className="min-h-screen bg-charcoal text-cream overflow-x-hidden">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap"
      />

      {/* HERO */}
      <section className="relative">
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] bg-blush/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20 grid lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-6 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blush/30 bg-blush/5 text-xs text-blush">
              <span className="h-1.5 w-1.5 rounded-full bg-blush animate-pulse" />
              Cozinha inteligente, em português
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl leading-[1.02] text-cream">
              {firstName ? `Olá, ${firstName}! Cozinhe` : "Cozinhe"} com o que{" "}
              <em className="font-display italic text-blush">você já tem</em> em casa.
            </h1>
            <p className="text-lg text-cream/70 max-w-xl leading-relaxed">
              O receitahub usa inteligência artificial para transformar a sua despensa em receitas
              reais, prontas em minutos. Sem listas de mercado, sem desperdício.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/receitas"
                className="inline-flex items-center gap-2 bg-blush text-charcoal px-7 py-4 rounded-full font-medium hover:bg-blush-deep transition"
              >
                Ver receitas de hoje
              </Link>
              <Link
                to="/minha-despensa"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-full border border-border text-cream/80 hover:border-blush/40 hover:text-cream transition"
              >
                Cadastrar despensa
              </Link>
            </div>
            <div className="flex items-center gap-8 pt-6 text-sm text-cream/60">
              <div>
                <div className="font-display text-2xl text-blush">∞</div>
                <div>Receitas via IA</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="font-display text-2xl text-blush">3 min</div>
                <div>Para o seu primeiro prato</div>
              </div>
              <div className="hidden sm:block h-10 w-px bg-border" />
              <div className="hidden sm:block">
                <div className="font-display text-2xl text-blush">-40%</div>
                <div>Desperdício de comida</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-border">
              <img
                src={heroImg}
                alt="Ingredientes frescos sobre tábua de ardósia"
                className="w-full h-full object-cover"
              />
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
                  {recipeCount !== null &&
                    recipeCount > 0 &&
                    ` e ${recipeCount} receita${recipeCount !== 1 ? "s" : ""} salva${recipeCount !== 1 ? "s" : ""}`}
                  .
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
            <h2 className="text-4xl md:text-5xl text-cream leading-tight">
              Da despensa ao prato em{" "}
              <em className="font-display italic text-blush">três passos</em>.
            </h2>
          </div>
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 relative">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-border">
                <img
                  src={stepImg}
                  alt="Despensa organizada com potes de vidro"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <ol className="lg:col-span-7 space-y-2">
              {steps.map((s) => (
                <li
                  key={s.n}
                  className="group grid grid-cols-[auto_1fr] gap-6 items-start py-8 border-b border-border last:border-b-0"
                >
                  <span className="font-display italic text-5xl text-blush/70 group-hover:text-blush transition">
                    {s.n}
                  </span>
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
            <h2 className="text-4xl md:text-5xl text-cream leading-tight">
              Receitas <em className="font-display italic text-blush">desta semana</em>.
            </h2>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Ação explícita: ignora o cache semanal e chama a IA de novo */}
            <button
              onClick={() => void loadFeatured(true)}
              disabled={loadingFeatured}
              className="px-4 py-2 rounded-full text-sm border border-blush/40 text-blush hover:bg-blush hover:text-charcoal transition disabled:opacity-50"
            >
              {loadingFeatured ? "Gerando…" : "Gerar novas"}
            </button>
            <Link
              to="/receitas"
              className="inline-flex items-center gap-2 text-cream/80 hover:text-blush transition text-sm border-b border-border hover:border-blush pb-1"
            >
              Ver todas as receitas
            </Link>
          </div>
        </div>

        {loadingFeatured ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-2xl bg-charcoal-light border border-border animate-pulse ${
                  i === 0 ? "aspect-[16/10] sm:col-span-2" : "aspect-[4/5]"
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-x-6 gap-y-12">
            {featured.map((r, i) => {
              // São 5 no total: o primeiro ocupa 2 colunas e os 4 menores
              // completam 6 unidades, fechando em 2 linhas exatas.
              const lead = i === 0;
              const isSaved = savedFeaturedIds.has(r.id);
              return (
                <div
                  key={r.id}
                  className={`group relative flex h-full w-full flex-col ${lead ? "sm:col-span-2" : ""}`}
                >
                  <button
                    onClick={() => setSelectedFeatured(r)}
                    className="flex h-full w-full flex-col text-left"
                  >
                    <RecipeCover
                      title={r.title}
                      category={r.category}
                      ingredients={r.ingredients}
                      imageUrl={r.image_url}
                      variant="solo"
                      className={`${lead ? "aspect-[16/10]" : "aspect-[4/5]"} rounded-2xl mb-4 border border-border group-hover:border-blush/40 transition`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        {r.diet && r.diet.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {r.diet.slice(0, 2).map((d) => (
                              <span
                                key={d}
                                className="text-[9px] uppercase tracking-wider bg-blush/20 text-blush px-2 py-0.5 rounded-full"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </RecipeCover>
                    <div className="flex items-baseline gap-3 text-sm mb-1.5">
                      <span className="text-blush/90">{r.category}</span>
                      {r.time_minutes ? (
                        <span className="inline-flex items-center gap-1 text-cream/45">
                          <Clock size={12} strokeWidth={1.5} />
                          {r.time_minutes} min
                        </span>
                      ) : null}
                    </div>
                    <h3
                      className={`font-display text-cream group-hover:text-blush transition leading-tight line-clamp-2 ${lead ? "text-3xl md:text-4xl" : "text-2xl"}`}
                    >
                      {r.title}
                    </h3>
                    {r.description && (
                      <p className="text-sm text-cream/60 mt-1 line-clamp-2">{r.description}</p>
                    )}
                  </button>

                  {/* Salvar rápido, sem precisar abrir o modal — mesmo padrão do card de /receitas */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSaveFeatured(r);
                    }}
                    disabled={savingFeaturedId === r.id || isSaved}
                    title={isSaved ? "Salva!" : "Salvar receita"}
                    className={`absolute top-3 right-3 h-9 w-9 flex items-center justify-center rounded-full border transition-all ${
                      isSaved
                        ? "bg-green-500/20 border-green-500/40 text-green-400"
                        : "bg-charcoal/80 backdrop-blur-sm border-border/60 text-cream/70 hover:bg-blush hover:border-blush hover:text-charcoal"
                    }`}
                  >
                    {isSaved ? (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
          <div className="inline-block">
            <h2 className="text-5xl md:text-6xl lg:text-7xl text-cream leading-[1.05] max-w-4xl mx-auto">
              O que tem na sua <em className="font-display italic text-blush">despensa</em> hoje?
            </h2>
            <p className="mt-6 text-lg text-cream/70 max-w-xl mx-auto">
              Em menos de 3 minutos a IA descobre tudo que você pode cozinhar — sem precisar ir ao
              mercado.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/minha-despensa"
                className="inline-flex items-center gap-2 bg-blush text-charcoal px-8 py-4 rounded-full font-medium hover:bg-blush-deep transition"
              >
                Cadastrar minha despensa
              </Link>
              <Link
                to="/receitas"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-border text-cream/80 hover:border-blush/40 hover:text-cream transition"
              >
                Explorar receitas primeiro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {selectedFeatured && (
        <FeaturedModal
          recipe={selectedFeatured}
          onClose={() => setSelectedFeatured(null)}
          onSave={handleSaveFeatured}
          saving={savingFeaturedId === selectedFeatured.id}
          saved={savedFeaturedIds.has(selectedFeatured.id)}
        />
      )}
    </div>
  );
}
