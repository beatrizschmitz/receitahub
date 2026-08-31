import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Clock, Download, FileText, Flame, Gauge, Star, Utensils, Wallet } from "lucide-react";
import { RecipeCover, RecipePhotoCredit } from "@/components/RecipeCover";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/minhas-receitas")({
  component: MyRecipesPage,
  head: () => ({
    meta: [
      { title: "Minhas receitas — receitahub" },
      { name: "description", content: "Suas receitas favoritas, salvas e organizadas em um só lugar." },
    ],
  }),
});

type UserRecipe = {
  id: string; title: string; image_url: string | null; category: string | null;
  image_photographer: string | null; image_photographer_url: string | null;
  time_minutes: number | null; difficulty: string | null; diet: string[] | null;
  description: string | null; is_favorite: boolean;
  ingredients: string[] | null; instructions: string | null;
  calories_per_serving: number | null; rating: number | null;
  notes: string | null; times_cooked: number;
  cost_home_brl: number | null; cost_delivery_brl: number | null;
};

type CalorieEntry = {
  id: string; recipe_id: string | null; recipe_title: string;
  calories: number; consumed_at: string;
};

// ─── Modal de detalhes da receita salva ──────────────────────────────────────
function RecipeDetailModal({ recipe, onClose, onDelete, onFavorite, onRate, onSaveNotes, onAteIt }: {
  recipe: UserRecipe; onClose: () => void;
  onDelete: (id: string) => void; onFavorite: (id: string, v: boolean) => void;
  onRate: (id: string, rating: number) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onAteIt: (r: UserRecipe) => void;
}) {
  const [servings, setServings] = useState(4);
  const [notesDraft, setNotesDraft] = useState(recipe.notes ?? "");
  const baseServings = 4;
  const ratio = servings / baseServings;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function scaleIngredient(text: string) {
    return text.replace(/(\d+[\d.,/]*)/g, (m) => {
      const n = parseFloat(m.replace(",", "."));
      if (isNaN(n)) return m;
      const s = n * ratio;
      return s % 1 === 0 ? String(s) : s.toFixed(1);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-recipe-title"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 bg-charcoal border border-border rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="relative rounded-t-3xl overflow-hidden">
          <RecipeCover title={recipe.title} category={recipe.category} ingredients={recipe.ingredients} imageUrl={recipe.image_url} className="h-56" variant="modal" />
          {/* Sempre escuro, nos dois temas: a função aqui não é seguir a paleta e sim
              garantir que o texto leia por cima de uma foto qualquer. */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-charcoal/80 text-cream hover:bg-charcoal transition text-lg">×</button>
          <button onClick={() => onFavorite(recipe.id, !recipe.is_favorite)}
            className={`absolute top-4 left-4 h-8 w-8 flex items-center justify-center rounded-full transition ${recipe.is_favorite ? "bg-blush text-charcoal" : "bg-charcoal/80 text-cream/60 hover:text-blush"}`}
            title={recipe.is_favorite ? "Remover dos favoritos" : "Favoritar"}>
            <Star className="h-4 w-4" strokeWidth={1.5} fill={recipe.is_favorite ? "currentColor" : "none"} />
          </button>
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex flex-wrap gap-2 mb-2">
              {recipe.diet?.map((d) => <span key={d} className="text-[10px] uppercase tracking-wider bg-blush/20 text-blush px-2 py-0.5 rounded-full">{d}</span>)}
            </div>
            <h2 id="saved-recipe-title" className="font-display text-3xl text-cream leading-tight drop-shadow-lg">{recipe.title}</h2>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex gap-4 text-sm text-cream/60 flex-wrap">
            {recipe.time_minutes && <span>⏱ {recipe.time_minutes} min</span>}
            {recipe.difficulty && <span className="inline-flex items-center gap-1.5"><Gauge size={14} strokeWidth={1.5} />{recipe.difficulty}</span>}
            {recipe.category && <span className="inline-flex items-center gap-1.5"><Utensils size={14} strokeWidth={1.5} />{recipe.category}</span>}
            {recipe.calories_per_serving && <span className="text-blush"><Flame size={14} strokeWidth={1.5} className="inline mr-1" />≈ {recipe.calories_per_serving} kcal/porção</span>}
            {recipe.cost_home_brl && recipe.cost_delivery_brl && (
              <span className="text-emerald-400">
                <Wallet size={14} strokeWidth={1.5} className="inline mr-1" />R$ {Number(recipe.cost_home_brl).toFixed(2)} em casa vs R$ {Number(recipe.cost_delivery_brl).toFixed(2)} delivery
              </span>
            )}
            {(recipe.times_cooked ?? 0) > 0 && <span className="text-emerald-400">feita {recipe.times_cooked}×</span>}
          </div>
          {recipe.description && <p className="text-cream/70 text-sm leading-relaxed">{recipe.description}</p>}

          {/* Avaliação + Comi isso */}
          <div className="bg-charcoal-light border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm text-cream/50 mb-1">Sua avaliação</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => onRate(recipe.id, n)}
                      className={`transition ${(recipe.rating ?? 0) >= n ? "text-amber-400" : "text-cream/20 hover:text-amber-400/60"}`}
                      title={`${n} estrela${n > 1 ? "s" : ""}`}
                    >
                      <Star className="h-6 w-6" strokeWidth={1.25} fill={(recipe.rating ?? 0) >= n ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
              {recipe.calories_per_serving && (
                <button
                  onClick={() => onAteIt(recipe)}
                  className="px-4 py-2 rounded-full bg-blush text-charcoal text-sm font-medium hover:bg-blush-deep transition"
                >
                  + Comi isso ({recipe.calories_per_serving} kcal)
                </button>
              )}
            </div>
            <div>
              <div className="text-sm text-cream/50 mb-2">Suas anotações</div>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => { if (notesDraft !== (recipe.notes ?? "")) onSaveNotes(recipe.id, notesDraft); }}
                rows={2}
                placeholder="Ex: ficou ótimo, da próxima usar menos sal..."
                className="w-full bg-charcoal border border-border rounded-xl p-3 text-cream placeholder:text-cream/45 text-sm focus:outline-none focus:border-blush/50 resize-none"
              />
            </div>
          </div>

          {/* Slider de porções */}
          <div className="bg-charcoal-light border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-cream/70">Porções</span>
              <span className="text-sm font-medium text-cream">{servings}</span>
            </div>
            <input type="range" min={1} max={12} step={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} className="w-full accent-[#C97B84]" />
            <div className="flex justify-between text-[10px] text-cream/40 mt-1"><span>1</span><span>6</span><span>12</span></div>
          </div>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-cream/80 mb-3">Ingredientes</h3>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-cream/80">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blush/60 flex-shrink-0" />
                    {scaleIngredient(ing)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.instructions && (
            <div>
              <h3 className="text-sm font-medium text-cream/80 mb-3">Modo de preparo</h3>
              <div className="text-sm text-cream/80 leading-relaxed space-y-2">
                {recipe.instructions.split("\n").map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </div>
          )}

          <button onClick={() => { onDelete(recipe.id); onClose(); }}
            className="w-full py-3 rounded-full text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition">
            Remover receita
          </button>
          <RecipePhotoCredit imageUrl={recipe.image_url} photographer={recipe.image_photographer} photographerUrl={recipe.image_photographer_url} className="text-center" />
        </div>
      </div>
    </div>
  );
}

// ─── Modal de importar receita ────────────────────────────────────────────────
function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (recipe: Partial<UserRecipe>) => void }) {
  const [tab, setTab] = useState<"texto" | "url">("texto");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleTextImport() {
    if (!text.trim()) return;
    setLoading(true); setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("parse-recipe", {
        body: { text },
      });
      if (fnError || data?.error) throw new Error(fnError?.message ?? data?.error ?? "Erro ao processar");
      onImport(data.recipe);
      onClose();
    } catch (e) {
      onImport({ title: "Receita importada", instructions: text, category: "prato principal" });
      onClose();
    } finally { setLoading(false); }
  }

  async function handleUrlImport() {
    if (!url.trim()) return;
    setLoading(true); setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("parse-recipe", {
        body: { url },
      });
      if (fnError || data?.error) throw new Error(fnError?.message ?? data?.error ?? "Erro ao processar");
      onImport(data.recipe);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível importar dessa URL.");
    } finally { setLoading(false); }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError("");
    try {
      const content = await file.text();
      const { data, error: fnError } = await supabase.functions.invoke("parse-recipe", {
        body: { text: content },
      });
      if (fnError || data?.error) throw new Error(fnError?.message ?? data?.error ?? "Erro ao processar");
      onImport(data.recipe);
      onClose();
    } catch {
      setError("Não foi possível ler o arquivo.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 bg-charcoal border border-border rounded-3xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl text-cream">Importar receita</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-cream/60 hover:text-cream transition text-lg">×</button>
          </div>

          <div className="flex gap-2 mb-6">
            {(["texto", "url"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-full text-sm first-letter:uppercase transition border ${tab === t ? "bg-blush text-charcoal border-blush" : "border-border text-cream/60 hover:text-cream"}`}>{t === "texto" ? "Colar texto / arquivo" : "URL do site"}</button>
            ))}
          </div>

          {tab === "texto" && (
            <div className="space-y-4">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
                placeholder="Cole aqui o texto da receita (ingredientes, modo de preparo...)"
                className="w-full bg-charcoal-light border border-border rounded-2xl p-4 text-cream placeholder:text-cream/40 text-sm focus:outline-none focus:border-blush/50 resize-none" />
              <div className="flex items-center gap-3">
                <button onClick={() => fileRef.current?.click()} disabled={loading}
                  className="px-4 py-2 rounded-full border border-border text-cream/70 text-sm hover:border-blush/40 transition">
                  Importar .txt
                </button>
                <input ref={fileRef} type="file" accept=".txt,.pdf" className="hidden" onChange={handleFileImport} />
                <button onClick={handleTextImport} disabled={loading || !text.trim()}
                  className="ml-auto px-6 py-2 rounded-full bg-blush text-charcoal text-sm font-medium hover:bg-blush-deep transition disabled:opacity-50">
                  {loading ? "Importando…" : "Importar"}
                </button>
              </div>
            </div>
          )}

          {tab === "url" && (
            <div className="space-y-4">
              <p className="text-sm text-cream/60">Cole a URL de um site de receitas (TudoGostoso, Panelinha, blogs, etc).</p>
              <input value={url} onChange={(e) => setUrl(e.target.value)} type="url"
                placeholder="https://www.tudogostoso.com.br/receita/..."
                className="w-full bg-charcoal-light border border-border rounded-full px-5 py-3 text-cream placeholder:text-cream/40 text-sm focus:outline-none focus:border-blush/50" />
              <p className="text-xs text-cream/40">A IA vai extrair título, ingredientes e modo de preparo automaticamente.</p>
              <button onClick={handleUrlImport} disabled={loading || !url.trim()}
                className="w-full py-3 rounded-full bg-blush text-charcoal text-sm font-medium hover:bg-blush-deep transition disabled:opacity-50">
                {loading ? "Importando…" : "Importar da URL"}
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-400 light:text-red-800">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function MyRecipesPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<UserRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<UserRecipe | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState<"todas" | "favoritas" | "melhor avaliadas" | "mais feitas">("todas");
  const [calorieEntries, setCalorieEntries] = useState<CalorieEntry[]>([]);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const [recipesRes, caloriesRes] = await Promise.all([
        supabase.from("user_recipes")
          .select("id, title, image_url, image_photographer, image_photographer_url, category, time_minutes, difficulty, diet, description, is_favorite, ingredients, instructions, calories_per_serving, rating, notes, times_cooked, cost_home_brl, cost_delivery_brl")
          .order("created_at", { ascending: false }),
        supabase.from("calorie_log")
          .select("id, recipe_id, recipe_title, calories, consumed_at")
          .eq("consumed_at", today)
          .order("created_at", { ascending: false }),
      ]);
      if (!recipesRes.error && recipesRes.data) setRecipes(recipesRes.data as UserRecipe[]);
      if (!caloriesRes.error && caloriesRes.data) setCalorieEntries(caloriesRes.data as CalorieEntry[]);
      setLoading(false);

      // Receitas salvas antes das fotos (ou importadas) não têm image_url.
      // Busca uma foto pelo título — o acerto é baixo, porque o Pexels indexa em
      // inglês e o título é português, mas o resultado (positivo ou negativo)
      // fica no cache da recipe_images e não custa nada nas próximas visitas.
      // Nada é gravado em user_recipes: a foto vale só para esta sessão.
      const semFoto = (recipesRes.data ?? []).filter((r) => !r.image_url);
      if (semFoto.length > 0) {
        const { data: imgData } = await supabase.functions.invoke("recipe-images", {
          body: { queries: semFoto.map((r) => r.title) },
        });
        const images = (imgData?.images ?? {}) as Record<
          string,
          { image_url: string; photographer: string; photographer_url: string } | null
        >;
        setRecipes((prev) =>
          prev.map((r) => {
            const found = r.image_url ? null : images[r.title];
            return found
              ? {
                  ...r,
                  image_url: found.image_url,
                  image_photographer: found.photographer,
                  image_photographer_url: found.photographer_url,
                }
              : r;
          }),
        );
      }
    })();
  }, [session]);

  async function handleDelete(id: string) {
    await supabase.from("user_recipes").delete().eq("id", id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleFavorite(id: string, value: boolean) {
    await supabase.from("user_recipes").update({ is_favorite: value }).eq("id", id);
    setRecipes((prev) => prev.map((r) => r.id === id ? { ...r, is_favorite: value } : r));
    if (selectedRecipe?.id === id) setSelectedRecipe((prev) => prev ? { ...prev, is_favorite: value } : prev);
  }

  async function handleRate(id: string, rating: number) {
    await supabase.from("user_recipes").update({ rating }).eq("id", id);
    setRecipes((prev) => prev.map((r) => r.id === id ? { ...r, rating } : r));
    if (selectedRecipe?.id === id) setSelectedRecipe((prev) => prev ? { ...prev, rating } : prev);
  }

  async function handleNotes(id: string, notes: string) {
    await supabase.from("user_recipes").update({ notes }).eq("id", id);
    setRecipes((prev) => prev.map((r) => r.id === id ? { ...r, notes } : r));
  }

  async function handleAteIt(recipe: UserRecipe, ev?: React.MouseEvent) {
    if (!session) return;
    ev?.stopPropagation();
    const calories = recipe.calories_per_serving;
    if (!calories) {
      alert("Essa receita ainda não tem calorias estimadas. Salve uma nova ou edite manualmente.");
      return;
    }
    const { data, error } = await supabase.from("calorie_log").insert({
      user_id: session.user.id,
      recipe_id: recipe.id,
      recipe_title: recipe.title,
      calories,
    }).select().single();
    if (!error && data) {
      setCalorieEntries((prev) => [data as CalorieEntry, ...prev]);
      // incrementa times_cooked
      const next = (recipe.times_cooked ?? 0) + 1;
      await supabase.from("user_recipes").update({ times_cooked: next }).eq("id", recipe.id);
      setRecipes((prev) => prev.map((r) => r.id === recipe.id ? { ...r, times_cooked: next } : r));
    }
  }

  async function handleRemoveCalorie(id: string) {
    await supabase.from("calorie_log").delete().eq("id", id);
    setCalorieEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleImport(partial: Partial<UserRecipe>) {
    if (!session) return;
    const { data, error } = await supabase.from("user_recipes").insert({
      user_id: session.user.id,
      title: partial.title ?? "Receita importada",
      description: partial.description ?? null,
      category: partial.category ?? "prato principal",
      instructions: partial.instructions ?? null,
      ingredients: partial.ingredients ?? null,
      diet: partial.diet ?? [],
      calories_per_serving: partial.calories_per_serving ?? null,
      cost_home_brl: partial.cost_home_brl ?? null,
      cost_delivery_brl: partial.cost_delivery_brl ?? null,
      time_minutes: partial.time_minutes ?? null,
      difficulty: partial.difficulty ?? null,
      is_favorite: false,
    }).select().single();
    if (!error && data) setRecipes((prev) => [data as UserRecipe, ...prev]);
  }

  if (authLoading || !session) return (
    <div className="min-h-screen bg-charcoal text-cream flex items-center justify-center">
      <div className="text-cream/50">Carregando...</div>
    </div>
  );

  const favorites = recipes.filter((r) => r.is_favorite);
  const totalCalories = calorieEntries.reduce((sum, e) => sum + e.calories, 0);
  const cookedCount = recipes.reduce((sum, r) => sum + (r.times_cooked ?? 0), 0);
  const totalSavings = recipes.reduce((sum, r) => {
    const home = Number(r.cost_home_brl ?? 0);
    const delivery = Number(r.cost_delivery_brl ?? 0);
    const times = r.times_cooked ?? 0;
    const diff = delivery - home;
    return sum + (diff > 0 ? diff * times : 0);
  }, 0);
  const recipesWithCost = recipes.filter((r) => r.cost_home_brl && r.cost_delivery_brl);
  const avgSavePerMeal = recipesWithCost.length
    ? recipesWithCost.reduce((s, r) => s + (Number(r.cost_delivery_brl) - Number(r.cost_home_brl)), 0) / recipesWithCost.length
    : 0;

  let displayed = recipes;
  if (filter === "favoritas") displayed = favorites;
  else if (filter === "melhor avaliadas") displayed = [...recipes].filter((r) => r.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else if (filter === "mais feitas") displayed = [...recipes].filter((r) => (r.times_cooked ?? 0) > 0).sort((a, b) => (b.times_cooked ?? 0) - (a.times_cooked ?? 0));

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap" />

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-16">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <h1 className="text-5xl md:text-6xl text-cream leading-tight">
              Minhas <em className="text-blush font-display italic">receitas</em>
            </h1>
            <p className="mt-4 text-cream/70 max-w-xl">Tudo que você salvou para preparar depois.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImport(true)}
              className="px-5 py-3 rounded-full border border-border text-sm hover:border-blush/40 transition">
              Importar receita
            </button>
          </div>
        </div>

        {/* Painel Calorias do dia */}
        <div className="mt-10 bg-gradient-to-br from-blush/15 to-blush/5 border border-blush/30 rounded-3xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-blush mb-2">Calorias hoje</div>
              <div className="font-display text-5xl text-cream">{totalCalories.toLocaleString("pt-BR")} <span className="text-2xl text-cream/50">kcal</span></div>
              <p className="text-xs text-cream/40 mt-2">Estimativas da IA — não substituem rótulo nutricional.</p>
            </div>
            {calorieEntries.length > 0 && (
              <div className="flex-1 min-w-[240px] max-w-md space-y-1.5">
                {calorieEntries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm bg-charcoal/40 rounded-full px-3 py-1.5">
                    <span className="text-cream/80 truncate flex-1">{e.recipe_title}</span>
                    <span className="text-blush text-xs">{e.calories} kcal</span>
                    <button onClick={() => handleRemoveCalorie(e.id)} className="text-cream/40 hover:text-red-400 transition">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Painel Economia */}
        <div className="mt-6 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 light:from-emerald-50 light:to-emerald-50/50 border border-emerald-500/30 light:border-emerald-600/40 rounded-3xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-emerald-400 light:text-emerald-800 mb-2">Economia cozinhando em casa</div>
              <div className="font-display text-5xl text-cream">
                R$ {totalSavings.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-cream/40 mt-2">
                Total economizado vs pedir delivery, com base nas {cookedCount} refeições que você marcou como feitas.
              </p>
            </div>
            {avgSavePerMeal > 0 && (
              <div className="min-w-[200px] bg-charcoal/40 rounded-2xl p-4 space-y-2">
                <div className="text-[11px] text-cream/50">Média por refeição</div>
                <div className="font-display text-3xl text-emerald-300">
                  R$ {avgSavePerMeal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-cream/40">
                  Estimativas da IA — preços médios BR 2025.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { l: "Salvas", v: recipes.length },
            { l: "Já preparadas", v: cookedCount },
            { l: "Favoritas", v: favorites.length },
          ].map((s) => (
            <div key={s.l} className="bg-charcoal-light rounded-2xl p-5 border border-border">
              <div className="text-sm text-cream/50">{s.l}</div>
              <div className="font-display text-3xl text-cream mt-2">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="mt-8 flex gap-2 flex-wrap">
          {(["todas", "favoritas", "melhor avaliadas", "mais feitas"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm first-letter:uppercase transition border ${filter === f ? "bg-blush text-charcoal border-blush" : "border-border text-cream/60 hover:text-cream"}`}>{f}</button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
        {loading ? (
          <div className="text-center py-16 text-cream/50">Carregando receitas...</div>
        ) : displayed.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-6">
            {displayed.map((r) => (
              <article key={r.id} onClick={() => setSelectedRecipe(r)}
                /* Favorita não é só um ícone a mais: a borda em terracota
                   distingue a coleção pessoal das sugestões geradas. */
                className={`group flex h-full flex-col cursor-pointer bg-charcoal-light rounded-2xl overflow-hidden border transition-all hover:border-blush/40 ${
                  r.is_favorite ? "border-blush/45" : "border-border"
                }`}>
                <RecipeCover title={r.title} category={r.category} ingredients={r.ingredients} imageUrl={r.image_url} className="aspect-[4/3]" variant="card" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3 text-sm mb-2">
                        {r.category && <span className="text-blush/90">{r.category}</span>}
                        {r.time_minutes ? (
                          <span className="inline-flex items-center gap-1 text-cream/45">
                            <Clock size={12} strokeWidth={1.5} />
                            {r.time_minutes} min
                          </span>
                        ) : null}
                      </div>
                      <h3 className="font-display text-2xl text-cream leading-tight mb-2 line-clamp-2 group-hover:text-blush transition">{r.title}</h3>
                      {r.description && <p className="text-sm text-cream/60 line-clamp-2">{r.description}</p>}
                    </div>
                    {r.is_favorite && <Star className="h-4 w-4 flex-shrink-0 fill-blush text-blush" strokeWidth={0} />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-auto pt-3 border-t border-border/50">
                    {r.calories_per_serving && (
                      <span className="text-[11px] bg-blush/15 text-blush px-2 py-1 rounded-full">≈ {r.calories_per_serving} kcal</span>
                    )}
                    {r.cost_home_brl && (
                      <span className="text-[11px] bg-emerald-500/15 text-emerald-300 px-2 py-1 rounded-full">
                        R$ {Number(r.cost_home_brl).toFixed(2)}
                      </span>
                    )}
                    {r.rating && (
                      <span className="text-[11px] bg-amber-500/15 text-amber-400 px-2 py-1 rounded-full">{r.rating} <Star size={10} className="inline fill-current" strokeWidth={0} /></span>
                    )}
                    {(r.times_cooked ?? 0) > 0 && (
                      <span className="text-[11px] bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded-full">{r.times_cooked}×</span>
                    )}
                    {r.calories_per_serving && (
                      <button
                        onClick={(ev) => handleAteIt(r, ev)}
                        className="ml-auto text-[11px] px-3 py-1 rounded-full border border-blush/40 text-blush hover:bg-blush hover:text-charcoal transition"
                        title="Registrar consumo de hoje"
                      >
                        + Comi isso
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 border border-dashed border-border rounded-3xl">
            <BookOpen className="mx-auto mb-4 h-9 w-9 text-cream/25" strokeWidth={1} />
            <h3 className="font-display text-2xl text-cream mb-2">
              {filter === "favoritas" ? "Nenhuma receita favoritada ainda" : "Sua coleção está vazia"}
            </h3>
            <p className="text-cream/60">
              {filter === "favoritas" ? "Abra uma receita salva e clique na estrela para favoritar." : "Salve receitas da página de receitas para encontrá-las aqui."}
            </p>
          </div>
        )}
      </section>

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onDelete={handleDelete}
          onFavorite={handleFavorite}
          onRate={handleRate}
          onSaveNotes={handleNotes}
          onAteIt={(r) => handleAteIt(r)}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
    </div>
  );
}
