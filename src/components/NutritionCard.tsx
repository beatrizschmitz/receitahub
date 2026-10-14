import { useEffect, useState } from "react";
import type { NutritionStatus } from "@/hooks/use-recipe-nutrition";
import type { RecipeNutrition } from "@/lib/recipe-nutrition";
import { TACO_SOURCE } from "@/lib/taco";
import { WEIGHT_LIMITS, formatPerKg, useStoredWeight } from "@/lib/weight";

type Props = {
  nutrition: RecipeNutrition | null;
  status: NutritionStatus;
  onRetry?: () => void;
  /** Multiplicador das porções escolhidas (1 = uma porção) */
  ratio?: number;
  /**
   * Quando não dá para calcular (receita sem ingredientes, sem login), em vez de
   * esconder o cartão mostra este texto e, se houver, as calorias já conhecidas.
   */
  unavailableText?: string;
  knownCalories?: number | null;
};

/**
 * Informação nutricional da receita: calorias, proteínas, carboidratos e
 * gorduras por porção, e os gramas por kg de peso quando a pessoa informa o peso.
 */
export function NutritionCard({
  nutrition,
  status,
  onRetry,
  ratio = 1,
  unavailableText,
  knownCalories,
}: Props) {
  const [weightKg, setWeightKg] = useStoredWeight();
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setDraft(weightKg ? String(weightKg).replace(".", ",") : "");
  }, [weightKg]);

  if (status === "unavailable" && !nutrition && !unavailableText) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-cream/80 mb-3">
        Informação nutricional{" "}
        <span className="text-cream/40 normal-case">
          {nutrition?.source === "taco" ? "(calculada com a TACO)" : "(estimativa via IA)"}
        </span>
      </h3>

      {status === "unavailable" && !nutrition && (
        <div className="space-y-3">
          {knownCalories ? (
            <div className="inline-block bg-charcoal-light border border-border rounded-xl px-6 py-3 text-center">
              <div className="text-lg font-display text-cream">
                {Math.round(knownCalories * ratio)}
              </div>
              <div className="text-[10px] text-cream/50">kcal</div>
              <div className="text-[10px] text-cream/40 mt-0.5">Calorias</div>
            </div>
          ) : null}
          <p className="text-sm text-cream/60">{unavailableText}</p>
        </div>
      )}

      {status === "loading" && !nutrition && (
        <p className="text-sm text-cream/60" role="status">
          Calculando a informação nutricional…
        </p>
      )}

      {status === "error" && !nutrition && (
        <p className="text-sm text-cream/60">
          Não consegui calcular agora.{" "}
          {onRetry && (
            <button type="button" onClick={onRetry} className="underline hover:text-blush">
              Tentar de novo
            </button>
          )}
        </p>
      )}

      {nutrition && (
        <>
          <label className="mb-3 flex flex-wrap items-center gap-2 text-xs text-cream/60">
            Seu peso para ver os gramas por kg
            <input
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = Number(e.target.value.replace(",", "."));
                if (e.target.value === "") setWeightKg(null);
                else if (n >= WEIGHT_LIMITS.min && n <= WEIGHT_LIMITS.max) setWeightKg(n);
              }}
              placeholder="Ex.: 68,5"
              aria-label="Seu peso em quilos"
              className="w-24 rounded-lg border border-border bg-charcoal px-3 py-1.5 text-sm text-cream placeholder:text-cream/45 focus:border-blush focus:outline-none"
            />
            kg
          </label>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Calorias", amount: nutrition.calories * ratio, unit: "kcal", perKg: false },
              { label: "Proteínas", amount: nutrition.protein * ratio, unit: "g", perKg: true },
              { label: "Carboidratos", amount: nutrition.carbs * ratio, unit: "g", perKg: true },
              { label: "Gorduras", amount: nutrition.fat * ratio, unit: "g", perKg: true },
            ].map((n) => (
              <div
                key={n.label}
                className="bg-charcoal-light border border-border rounded-xl p-3 text-center"
              >
                <div className="text-lg font-display text-cream">{Math.round(n.amount)}</div>
                <div className="text-[10px] text-cream/50">{n.unit}</div>
                <div className="text-[10px] text-cream/40 mt-0.5">{n.label}</div>
                {n.perKg && weightKg ? (
                  <div className="mt-1.5 border-t border-border pt-1.5 text-[10px] text-cream/60">
                    {formatPerKg(n.amount, weightKg)} g por kg
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {nutrition.source === "taco" && (
            <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-cream/50">
              <p>Fonte: {TACO_SOURCE}.</p>
              {nutrition.approx && (
                <p>
                  Medidas caseiras (colher, xícara, unidade) foram convertidas em gramas de forma
                  aproximada.
                </p>
              )}
              {nutrition.unmatched && nutrition.unmatched.length > 0 && (
                <p>
                  Sem correspondente na tabela e fora da conta: {nutrition.unmatched.join(", ")}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
