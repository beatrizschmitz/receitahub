import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Lock, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { generateDietPlan, type DietPlan } from "@/lib/ai.functions";
import { PLAN_TITLE } from "@/lib/plans";
import { TACO_SOURCE } from "@/lib/taco";
import { formatPerKg } from "@/lib/weight";
import {
  ACTIVITY_OPTIONS,
  GOAL_LABEL,
  LIMITS,
  calculateTargets,
  detectGoal,
  validateBody,
  type Activity,
  type BodyData,
  type NutritionTargets,
  type Sex,
} from "@/lib/nutrition";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dieta")({
  component: DietPage,
  head: () => ({
    meta: [
      { title: "Plano alimentar personalizado — receitahub" },
      {
        name: "description",
        content:
          "Receba um cardápio de 7 dias com calorias, feito pela IA do receitahub para o seu objetivo e suas restrições alimentares.",
      },
      { property: "og:title", content: "Plano alimentar personalizado — receitahub" },
      {
        property: "og:description",
        content: "Cardápio semanal com calorias, sob medida para o seu objetivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const RESTRICTIONS = [
  "sem glúten",
  "sem lactose",
  "vegetariano",
  "vegano",
  "low carb",
  "sem açúcar",
  "sem frutos do mar",
  "sem oleaginosas",
];

const OBJECTIVES = [
  "perder peso",
  "ganhar massa muscular",
  "manter o peso",
  "comer mais saudável",
  "reduzir o colesterol",
];

const BODY_STORAGE_KEY = "receitahub:dieta-corpo";

type BodyForm = {
  sex: Sex | "";
  age: string;
  weight: string;
  height: string;
  activity: Activity | "";
  pregnant: boolean;
};

const EMPTY_BODY: BodyForm = {
  sex: "",
  age: "",
  weight: "",
  height: "",
  activity: "",
  pregnant: false,
};

const toNumber = (v: string) => Number(v.replace(",", "."));

function bodyFromForm(f: BodyForm): Partial<BodyData> {
  return {
    sex: f.sex || undefined,
    age: toNumber(f.age),
    weightKg: toNumber(f.weight),
    heightCm: toNumber(f.height),
    activity: f.activity || undefined,
    pregnantOrLactating: f.sex === "feminino" && f.pregnant,
  };
}

const fieldClass =
  "mt-2 w-full rounded-lg border border-border bg-charcoal px-4 py-2.5 text-sm text-cream placeholder:text-cream/45 focus:border-blush focus:outline-none";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="text-xs text-cream/50">{label}</div>
      <div className="font-display text-2xl text-blush mt-1">{value}</div>
      {hint && <div className="text-[11px] text-cream/45 mt-0.5">{hint}</div>}
    </div>
  );
}

function MacroBar({ t }: { t: NutritionTargets }) {
  const p = t.proteinG * 4;
  const c = t.carbsG * 4;
  const f = t.fatG * 9;
  const total = p + c + f || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-blush" style={{ width: `${pct(p)}%` }} />
        <div className="bg-blush/55" style={{ width: `${pct(c)}%` }} />
        <div className="bg-blush/25" style={{ width: `${pct(f)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-cream/65">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-blush mr-1.5" />
          Proteína ({pct(p)}%)
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-blush/55 mr-1.5" />
          Carboidrato ({pct(c)}%)
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-blush/25 mr-1.5" />
          Gordura ({pct(f)}%)
        </span>
      </div>
    </div>
  );
}

function TargetsPanel({ t, title }: { t: NutritionTargets; title: string }) {
  const adj = t.adjustmentKcal;
  return (
    <div className="rounded-2xl border border-blush/30 bg-blush/[0.05] p-5">
      <h3 className="text-sm text-blush">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Meta diária" value={`${t.kcal} kcal`} />
        <Stat label="Gasto total estimado" value={`${t.tdee} kcal`} hint={`basal ${t.bmr} kcal`} />
        <Stat label="IMC" value={String(t.bmi).replace(".", ",")} hint={t.bmiClass} />
        <Stat
          label="Ajuste do objetivo"
          value={adj === 0 ? "manutenção" : `${adj > 0 ? "+" : ""}${adj} kcal`}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Proteína por dia"
          value={`${t.proteinG} g`}
          hint={`${formatPerKg(t.proteinG, t.inputs.weightKg)} g por kg de peso`}
        />
        <Stat
          label="Carboidrato por dia"
          value={`${t.carbsG} g`}
          hint={`${formatPerKg(t.carbsG, t.inputs.weightKg)} g por kg de peso`}
        />
        <Stat
          label="Gordura por dia"
          value={`${t.fatG} g`}
          hint={`${formatPerKg(t.fatG, t.inputs.weightKg)} g por kg de peso`}
        />
      </div>
      <div className="mt-4">
        <MacroBar t={t} />
      </div>
      <p className="mt-3 text-xs text-cream/55">
        Fibras: ao menos {t.fiberG} g por dia. Água: cerca de{" "}
        {(t.waterMl / 1000).toFixed(1).replace(".", ",")} L por dia.
      </p>
      {t.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 light:text-amber-900">
          {t.warnings.map((w, i) => (
            <li key={i}>
              <span className="font-medium">Atenção:</span> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** " (1,8 g/kg)" quando o plano traz o peso usado no cálculo; vazio nos planos antigos. */
function perKgSuffix(grams: number | null | undefined, n: NutritionTargets | undefined): string {
  if (!grams || !n) return "";
  return ` (${formatPerKg(grams, n.inputs.weightKg)} g/kg)`;
}

function DietPage() {
  const { session, loading: authLoading } = useAuth();
  const { hasDietPlans, loading: subLoading, tier } = useSubscription();
  const navigate = useNavigate();
  const runGenerate = useServerFn(generateDietPlan);

  const [objective, setObjective] = useState("");
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [body, setBody] = useState<BodyForm>(EMPTY_BODY);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [history, setHistory] = useState<
    { id: string; title: string | null; created_at: string }[]
  >([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BODY_STORAGE_KEY);
      if (saved) setBody({ ...EMPTY_BODY, ...(JSON.parse(saved) as Partial<BodyForm>) });
    } catch {
      /* sem storage: segue com o formulário vazio */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BODY_STORAGE_KEY, JSON.stringify(body));
    } catch {
      /* ignorado */
    }
  }, [body]);

  // Prévia ao vivo das metas, antes de gerar o cardápio. Precisa ficar antes
  // dos returns antecipados abaixo (regras dos hooks).
  const preview = useMemo(() => {
    const b = bodyFromForm(body);
    if (!validateBody(b).ok) return null;
    return calculateTargets(b as BodyData, detectGoal(objective));
  }, [body, objective]);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session || !hasDietPlans) return;
    (async () => {
      const { data } = await supabase
        .from("diet_plans")
        .select("id, title, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory(data ?? []);
    })();
  }, [session, hasDietPlans]);

  if (authLoading || !session || subLoading) {
    return (
      <div className="min-h-screen bg-charcoal text-cream">
        <div className="py-24 text-center text-cream/50">Carregando…</div>
      </div>
    );
  }

  if (!hasDietPlans) {
    return (
      <div className="min-h-screen bg-charcoal text-cream">
        <main className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-blush/40 bg-blush/10">
            <Lock className="text-blush" size={24} />
          </div>
          <h1 className="font-display italic text-3xl text-blush mt-6">
            O plano alimentar é exclusivo do plano Premium
          </h1>
          <p className="text-cream/60 mt-3 leading-relaxed">
            Seu plano atual é o <span className="text-blush">{PLAN_TITLE[tier]}</span>. Assine o
            plano Premium para receber cardápios semanais com calorias, adaptados ao seu objetivo.
          </p>
          <Link
            to="/planos"
            className="inline-block mt-8 rounded-full bg-blush px-7 py-3 text-sm text-charcoal hover:bg-blush-deep transition"
          >
            Ver planos
          </Link>
        </main>
      </div>
    );
  }

  const toggleRestriction = (r: string) =>
    setRestrictions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (objective.trim().length < 3) {
      toast.error("Escolha ou descreva seu objetivo.");
      return;
    }
    const bodyData = bodyFromForm(body);
    const check = validateBody(bodyData);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setBusy(true);
    setPlan(null);
    try {
      const { data: pantry } = await supabase
        .from("pantry_items")
        .select("name")
        .eq("user_id", session.user.id);
      const result = await runGenerate({
        data: {
          objective: objective.trim(),
          restrictions,
          notes: notes.trim(),
          pantry: (pantry ?? []).map((p) => p.name),
          body: bodyData as BodyData,
        },
      });
      setPlan(result);
      const { data: inserted } = await supabase
        .from("diet_plans")
        .insert({
          user_id: session.user.id,
          title: result.title ?? objective.trim(),
          objective: objective.trim(),
          restrictions,
          profile_notes:
            [
              `${bodyData.sex}, ${bodyData.age} anos, ${bodyData.weightKg} kg, ${bodyData.heightCm} cm, atividade: ${bodyData.activity}`,
              notes.trim(),
            ]
              .filter(Boolean)
              .join(" | ") || null,
          generated_plan: result as unknown as Json,
        })
        .select("id, title, created_at")
        .maybeSingle();
      if (inserted) setHistory((prev) => [inserted, ...prev]);
      toast.success("Plano gerado e salvo.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Não consegui gerar o plano.");
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (id: string) => {
    const { data } = await supabase
      .from("diet_plans")
      .select("generated_plan")
      .eq("id", id)
      .maybeSingle();
    if (data?.generated_plan) setPlan(data.generated_plan as unknown as DietPlan);
  };

  const confirmRename = async (id: string) => {
    const title = renameValue.trim();
    if (!title) {
      toast.error("Dê um nome ao plano.");
      return;
    }
    const { error } = await supabase.from("diet_plans").update({ title }).eq("id", id);
    if (error) {
      toast.error("Não consegui renomear o plano.");
      return;
    }
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, title } : h)));
    setRenamingId(null);
    toast.success("Plano renomeado.");
  };

  const handleDelete = async () => {
    const id = deletingId;
    if (!id) return;
    setDeletingId(null);
    const { error } = await supabase.from("diet_plans").delete().eq("id", id);
    if (error) {
      toast.error("Não consegui apagar o plano.");
      return;
    }
    setHistory((prev) => prev.filter((h) => h.id !== id));
    toast.success("Plano apagado.");
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
        <h1 className="font-display italic text-4xl text-blush mt-3">Seu cardápio sob medida</h1>
        <p className="text-cream/60 mt-3">
          Informe seus dados e seu objetivo. Calculamos quanto você precisa comer por dia (calorias,
          proteínas, carboidratos e gorduras) e a IA monta 7 dias de refeições com as quantidades
          exatas de cada alimento, priorizando o que já está na sua despensa.
        </p>

        <form
          onSubmit={handleGenerate}
          className="mt-8 rounded-2xl border border-border bg-cream/[0.02] p-6 space-y-6"
        >
          <div>
            <label className="text-sm text-cream/70">Seus dados</label>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <span className="text-xs text-cream/50">Sexo biológico</span>
                <select
                  value={body.sex}
                  onChange={(e) =>
                    setBody({ ...body, sex: e.target.value as Sex | "", pregnant: false })
                  }
                  className={fieldClass}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </div>
              <div>
                <span className="text-xs text-cream/50">Idade (anos)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.age.min}
                  max={LIMITS.age.max}
                  value={body.age}
                  onChange={(e) => setBody({ ...body, age: e.target.value })}
                  placeholder="Ex.: 28"
                  className={fieldClass}
                />
              </div>
              <div>
                <span className="text-xs text-cream/50">Peso (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={LIMITS.weightKg.min}
                  max={LIMITS.weightKg.max}
                  value={body.weight}
                  onChange={(e) => setBody({ ...body, weight: e.target.value })}
                  placeholder="Ex.: 68,5"
                  className={fieldClass}
                />
              </div>
              <div>
                <span className="text-xs text-cream/50">Altura (cm)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.heightCm.min}
                  max={LIMITS.heightCm.max}
                  value={body.height}
                  onChange={(e) => setBody({ ...body, height: e.target.value })}
                  placeholder="Ex.: 165"
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs text-cream/50">Nível de atividade física</span>
              <select
                value={body.activity}
                onChange={(e) => setBody({ ...body, activity: e.target.value as Activity | "" })}
                className={fieldClass}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {ACTIVITY_OPTIONS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label} — {a.hint}
                  </option>
                ))}
              </select>
            </div>
            {body.sex === "feminino" && (
              <label className="mt-3 flex items-center gap-2 text-xs text-cream/65">
                <input
                  type="checkbox"
                  checked={body.pregnant}
                  onChange={(e) => setBody({ ...body, pregnant: e.target.checked })}
                  className="accent-[var(--blush)]"
                />
                Estou gestante ou amamentando
              </label>
            )}
            <p className="mt-2 text-[11px] text-cream/45">
              São dados de saúde: usamos apenas para calcular seu plano, que fica salvo na sua
              conta. Você pode apagá-los quando quiser em Perfil. Veja a{" "}
              <Link to="/privacidade" className="underline hover:text-blush">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>

          <div>
            <label className="text-sm text-cream/70">Objetivo</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {OBJECTIVES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setObjective(o)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    objective === o
                      ? "border-blush bg-blush/10 text-blush"
                      : "border-border text-cream/60 hover:text-cream"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ou escreva seu objetivo"
              className="mt-3 w-full rounded-lg border border-border bg-charcoal px-4 py-2.5 text-sm text-cream placeholder:text-cream/45 focus:border-blush focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-cream/70">Restrições alimentares</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESTRICTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRestriction(r)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    restrictions.includes(r)
                      ? "border-blush bg-blush/10 text-blush"
                      : "border-border text-cream/60 hover:text-cream"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-cream/70">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ex.: treino 4 vezes por semana, não gosto de peixe, cozinho só à noite"
              className="mt-2 w-full rounded-lg border border-border bg-charcoal px-4 py-2.5 text-sm text-cream placeholder:text-cream/45 focus:border-blush focus:outline-none"
            />
          </div>

          {preview ? (
            <TargetsPanel
              t={preview}
              title={`Suas metas diárias — ${GOAL_LABEL[preview.inputs.goal].toLowerCase()}`}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-cream/50">
              Preencha sexo, idade, peso, altura e atividade física para ver suas metas diárias
              calculadas.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-blush px-7 py-3 text-sm text-charcoal transition hover:bg-blush-deep disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Montando cardápio…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Gerar plano de 7 dias
              </>
            )}
          </button>
        </form>

        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm text-cream/50">Planos salvos</h2>
            <div className="mt-3 grid gap-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  {renamingId === h.id ? (
                    <>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(h.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 rounded-lg border border-border bg-charcoal px-3 py-1.5 text-xs text-cream focus:border-blush focus:outline-none"
                      />
                      <button
                        onClick={() => confirmRename(h.id)}
                        aria-label="Salvar nome"
                        className="rounded-full p-1.5 text-blush hover:bg-blush/10 transition"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        aria-label="Cancelar"
                        className="rounded-full p-1.5 text-cream/50 hover:text-cream transition"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openHistory(h.id)}
                        className="flex-1 text-left text-xs text-cream/65 hover:text-blush transition"
                      >
                        {h.title || "plano"} —{" "}
                        <span className="text-cream/55">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setRenamingId(h.id);
                          setRenameValue(h.title || "");
                        }}
                        aria-label="Renomear plano"
                        className="rounded-full p-1.5 text-cream/45 hover:text-blush hover:bg-blush/10 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingId(h.id)}
                        aria-label="Apagar plano"
                        className="rounded-full p-1.5 text-cream/45 hover:text-red-400 hover:bg-red-400/10 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {plan && (
          <section className="mt-10">
            <h2 className="font-display italic text-3xl text-blush">{plan.title}</h2>
            <p className="text-cream/65 mt-2">{plan.summary}</p>
            {plan.nutrition ? (
              <div className="mt-4">
                <TargetsPanel t={plan.nutrition} title="Metas usadas neste plano" />
              </div>
            ) : (
              plan.daily_calories_target && (
                <p className="text-sm text-blush mt-2">
                  Meta diária: {plan.daily_calories_target} kcal
                </p>
              )
            )}

            <div className="mt-6 grid gap-4">
              {(plan.days ?? []).map((day) => (
                <div key={day.day} className="rounded-2xl border border-border p-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-cream">{day.day}</h3>
                    {day.total_calories ? (
                      <span className="text-xs text-cream/55">
                        {day.total_calories} kcal
                        {day.total_protein_g
                          ? `, proteína ${day.total_protein_g} g${perKgSuffix(day.total_protein_g, plan.nutrition)}, carboidrato ${day.total_carbs_g} g${perKgSuffix(day.total_carbs_g, plan.nutrition)}, gordura ${day.total_fat_g} g${perKgSuffix(day.total_fat_g, plan.nutrition)}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {(day.meals ?? []).map((meal, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-blush/80">{meal.meal}</span>
                        <span className="text-cream/80"> — {meal.name}</span>
                        {meal.calories ? (
                          <span className="text-cream/55">
                            {" "}
                            ({meal.calories} kcal
                            {meal.protein_g
                              ? `, proteína ${meal.protein_g} g, carboidrato ${meal.carbs_g} g, gordura ${meal.fat_g} g`
                              : ""}
                            )
                          </span>
                        ) : null}
                        {meal.items && meal.items.length > 0 && (
                          <ul className="mt-1 ml-4 list-disc text-xs text-cream/60 space-y-0.5">
                            {meal.items.map((it, k) => (
                              <li key={k}>
                                {it.food}
                                {it.quantity ? ` — ${it.quantity}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                        {meal.description && (
                          <p className="text-cream/45 text-xs mt-0.5">{meal.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[11px] leading-relaxed text-cream/45">
              As metas foram calculadas com a equação de Mifflin-St Jeor e faixas usuais de
              macronutrientes.
              {plan.source === "taco"
                ? ` Os nutrientes dos alimentos vêm da ${TACO_SOURCE}.`
                : ""}{" "}
              Não substitui a avaliação de um nutricionista — em caso de doença, gravidez, uso de
              medicamentos ou transtorno alimentar, procure acompanhamento profissional antes de
              seguir qualquer plano.
            </p>

            {plan.tips?.length ? (
              <div className="mt-6 rounded-2xl border border-blush/30 bg-blush/[0.05] p-5">
                <h3 className="text-sm text-blush">Dicas do chef</h3>
                <ul className="mt-2 space-y-1 text-sm text-cream/70">
                  {plan.tips.map((t, i) => (
                    <li key={i}>• {t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        )}
      </main>

      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent className="max-w-md border-border bg-charcoal text-cream sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display italic text-2xl font-normal text-blush">
              Apagar este plano?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 leading-relaxed">
              O cardápio salvo será removido da sua lista. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream">
              Manter
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="rounded-full bg-blush px-6 py-2.5 text-sm text-charcoal transition hover:bg-blush-deep"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
