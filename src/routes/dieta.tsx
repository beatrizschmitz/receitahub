import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Lock, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { generateDietPlan, type DietPlan } from "@/lib/ai.functions";
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
      { title: "Plano de dieta personalizado — receitahub" },
      {
        name: "description",
        content:
          "Receba um cardápio de 7 dias com calorias, feito pela IA do receitahub para o seu objetivo e suas restrições alimentares.",
      },
      { property: "og:title", content: "Plano de dieta personalizado — receitahub" },
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

function DietPage() {
  const { session, loading: authLoading } = useAuth();
  const { hasDietPlans, loading: subLoading, tier } = useSubscription();
  const navigate = useNavigate();
  const runGenerate = useServerFn(generateDietPlan);

  const [objective, setObjective] = useState("");
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [history, setHistory] = useState<{ id: string; title: string | null; created_at: string }[]>(
    [],
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <div className="py-24 text-center text-cream/50">carregando...</div>
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
            planos de dieta são exclusivos do premium
          </h1>
          <p className="text-cream/60 mt-3 leading-relaxed">
            Seu plano atual é o{" "}
            <span className="text-blush">{tier === "free" ? "gratuito" : tier}</span>. Assine o
            premium para receber cardápios semanais com calorias, adaptados ao seu objetivo.
          </p>
          <Link
            to="/planos"
            className="inline-block mt-8 rounded-full bg-blush px-7 py-3 text-sm text-charcoal hover:bg-blush-deep transition"
          >
            ver planos
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
          profile_notes: notes.trim() || null,
          generated_plan: result as unknown as Json,
        })
        .select("id, title, created_at")
        .maybeSingle();
      if (inserted) setHistory((prev) => [inserted, ...prev]);
      toast.success("Plano gerado e salvo! 🥗");
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
    toast.success("Plano renomeado! ✏️");
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
    toast.success("Plano apagado. 🗑️");
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
        <p className="text-xs uppercase tracking-[0.25em] text-cream/40">premium</p>
        <h1 className="font-display italic text-4xl text-blush mt-3">seu cardápio sob medida 🥗</h1>
        <p className="text-cream/60 mt-3">
          Conte seu objetivo e suas restrições. A IA monta 7 dias de refeições com calorias,
          priorizando o que já está na sua despensa.
        </p>

        <form
          onSubmit={handleGenerate}
          className="mt-8 rounded-2xl border border-border bg-cream/[0.02] p-6 space-y-6"
        >
          <div>
            <label className="text-sm text-cream/70">objetivo</label>
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
              placeholder="ou escreva seu objetivo"
              className="mt-3 w-full rounded-lg border border-border bg-charcoal px-4 py-2.5 text-sm text-cream placeholder:text-cream/45 focus:border-blush focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-cream/70">restrições alimentares</label>
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
            <label className="text-sm text-cream/70">observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="ex: treino 4x por semana, não gosto de peixe, cozinho só à noite"
              className="mt-2 w-full rounded-lg border border-border bg-charcoal px-4 py-2.5 text-sm text-cream placeholder:text-cream/45 focus:border-blush focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-blush px-7 py-3 text-sm text-charcoal transition hover:bg-blush-deep disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={16} /> montando cardápio...
              </>
            ) : (
              <>
                <Sparkles size={16} /> gerar plano de 7 dias
              </>
            )}
          </button>
        </form>

        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm text-cream/50">planos salvos</h2>
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
                        aria-label="salvar nome"
                        className="rounded-full p-1.5 text-blush hover:bg-blush/10 transition"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        aria-label="cancelar"
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
                        {h.title || "plano"} ·{" "}
                        <span className="text-cream/55">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setRenamingId(h.id);
                          setRenameValue(h.title || "");
                        }}
                        aria-label="renomear plano"
                        className="rounded-full p-1.5 text-cream/45 hover:text-blush hover:bg-blush/10 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingId(h.id)}
                        aria-label="apagar plano"
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
            {plan.daily_calories_target && (
              <p className="text-sm text-blush mt-2">
                🔥 meta diária: {plan.daily_calories_target} kcal
              </p>
            )}

            <div className="mt-6 grid gap-4">
              {(plan.days ?? []).map((day) => (
                <div key={day.day} className="rounded-2xl border border-border p-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-cream">{day.day}</h3>
                    {day.total_calories ? (
                      <span className="text-xs text-cream/40">{day.total_calories} kcal</span>
                    ) : null}
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {(day.meals ?? []).map((meal, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-blush/80">{meal.meal}</span>
                        <span className="text-cream/80"> — {meal.name}</span>
                        {meal.calories ? (
                          <span className="text-cream/55"> ({meal.calories} kcal)</span>
                        ) : null}
                        {meal.description && (
                          <p className="text-cream/45 text-xs mt-0.5">{meal.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {plan.tips?.length ? (
              <div className="mt-6 rounded-2xl border border-blush/30 bg-blush/[0.05] p-5">
                <h3 className="text-sm text-blush">dicas do chef</h3>
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
              apagar este plano?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 leading-relaxed">
              O cardápio salvo será removido da sua lista. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream">
              manter
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="rounded-full bg-blush px-6 py-2.5 text-sm text-charcoal transition hover:bg-blush-deep"
            >
              apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
