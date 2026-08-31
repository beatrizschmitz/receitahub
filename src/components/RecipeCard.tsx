import { type Recipe } from "@/data/recipes";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { IngredientSubstitute } from "@/components/IngredientSubstitute";

export function RecipeCard({ recipe, pantry = [] }: { recipe: Recipe; pantry?: string[] }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(!!recipe.saved);
  const [saving, setSaving] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      navigate({ to: "/cadastro" });
      return;
    }

    if (saving) return;
    setSaving(true);

    const { error } = await supabase.from("user_recipes").insert({
      user_id: session.user.id,
      title: recipe.title,
      image_url: recipe.image,
      category: recipe.category,
      time_minutes: recipe.time,
      difficulty: recipe.difficulty,
      diet: recipe.diet,
      description: recipe.description,
      ingredients: recipe.ingredients ?? [],
      instructions: recipe.instructions ?? null,
      is_favorite: true,
    });

    setSaving(false);
    if (!error) setSaved(true);
  };

  const ingredients = recipe.ingredients ?? [];

  return (
    <article className="group relative bg-charcoal-light rounded-2xl overflow-hidden border border-border hover:border-blush/40 transition-all duration-500 hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Match badge */}
        <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-charcoal/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-blush/30">
          <span className="h-1.5 w-1.5 rounded-full bg-blush animate-pulse" />
          <span className="text-xs text-cream font-medium">{recipe.matchPercent}% match</span>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="absolute top-4 right-4 h-9 w-9 rounded-full bg-charcoal/80 backdrop-blur-md border border-border flex items-center justify-center hover:bg-blush hover:text-charcoal transition disabled:opacity-70"
          aria-label={session ? "Salvar receita" : "Crie uma conta para salvar"}
          title={session ? (saved ? "Salva" : "Salvar receita") : "Crie uma conta para salvar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            className={`h-4 w-4 ${saved ? "text-blush" : "text-cream"}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
            />
          </svg>
        </button>

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 p-5">
          <div className="text-sm text-blush/90 mb-2">{recipe.category}</div>
          <h3 className="font-display text-2xl text-cream leading-tight">{recipe.title}</h3>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {recipe.description}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-cream/70">
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" />
              </svg>
              {recipe.time} min
            </span>
            {/* valor sempre de uma palavra ("fácil"/"médio"/"difícil"), então capitalize
                equivale a sentence case — e ::first-letter não funciona em span inline */}
            <span className="capitalize">{recipe.difficulty}</span>
          </div>
          <div className="flex gap-1">
            {recipe.diet.slice(0, 2).map((d) => (
              <span
                key={d}
                className="text-[10px] uppercase tracking-wider bg-blush/10 text-blush px-2 py-1 rounded-full border border-blush/20"
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {ingredients.length > 0 && (
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setShowIngredients((s) => !s)}
              className="text-sm text-cream/60 hover:text-blush transition flex items-center gap-2 w-full"
            >
              <span>
                {showIngredients ? "ocultar" : "ver"} ingredientes ({ingredients.length})
              </span>
              <span className="ml-auto">{showIngredients ? "−" : "+"}</span>
            </button>
            {showIngredients && (
              <ul className="mt-3 space-y-2">
                {ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm text-cream/80"
                  >
                    <span className="truncate">{ing}</span>
                    <IngredientSubstitute ingredient={ing} pantry={pantry} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
