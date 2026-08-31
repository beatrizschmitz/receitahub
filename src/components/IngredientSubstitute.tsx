import { useState } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

type Substitute = { name: string; note: string; inPantry: boolean };

// In-memory cache shared across instances within the session
const cache = new Map<string, Substitute[]>();

export function IngredientSubstitute({
  ingredient,
  pantry,
}: {
  ingredient: string;
  pantry: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Substitute[]>(() => cache.get(ingredient.toLowerCase()) ?? []);

  async function load() {
    const key = ingredient.toLowerCase();
    if (cache.has(key)) {
      setSubs(cache.get(key)!);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "ingredient-substitutes",
        { body: { ingredient, pantry } }
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const list: Substitute[] = data?.substitutes ?? [];
      cache.set(key, list);
      setSubs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && subs.length === 0) load();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[10px] uppercase tracking-wider text-blush/80 hover:text-blush border border-blush/30 hover:border-blush rounded-full px-2 py-0.5 transition"
        >
          Substituir
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 bg-charcoal-light border-border text-cream p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-blush" />
          <p className="text-sm text-blush">
            substitutos para {ingredient}
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-cream/60 py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando...
          </div>
        )}

        {error && !loading && (
          <div className="text-sm text-red-400 light:text-red-700">{error}</div>
        )}

        {!loading && !error && subs.length > 0 && (
          <ul className="space-y-3">
            {subs.map((s, i) => (
              <li key={i} className="border-b border-border last:border-0 pb-2 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-cream font-medium">{s.name}</span>
                  {s.inPantry && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                      <Check className="h-2.5 w-2.5" /> você tem
                    </span>
                  )}
                </div>
                <p className="text-xs text-cream/60 mt-1 leading-snug">{s.note}</p>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && subs.length === 0 && (
          <div className="text-sm text-cream/50">Nenhuma sugestão encontrada.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
