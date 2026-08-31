import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS, PLAN_LABEL, type PlanTier } from "@/lib/plans";
import { toast } from "sonner";

export const Route = createFileRoute("/planos")({
  component: PlansPage,
  head: () => ({
    meta: [
      { title: "Planos e assinatura — receitahub" },
      {
        name: "description",
        content:
          "Compare os planos gratuito, básico e premium do receitahub: chef por IA ilimitado, reconhecimento de ingredientes por foto e planos de dieta personalizados.",
      },
      { property: "og:title", content: "Planos e assinatura — receitahub" },
      {
        property: "og:description",
        content:
          "Escolha entre gratuito, básico e premium e cozinhe melhor com o que você já tem em casa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PlansPage() {
  const { session } = useAuth();
  const { tier, loading, changePlan, currentPeriodEnd } = useSubscription();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PlanTier | null>(null);

  const handleSelect = async (next: PlanTier) => {
    if (!session) {
      navigate({ to: "/cadastro" });
      return;
    }
    if (next === tier) return;
    if (next !== "free") {
      navigate({ to: "/pagamento", search: { plan: next } });
      return;
    }
    setPending(next);
    const ok = await changePlan(next);
    setPending(null);
    if (ok) {
      toast.success(
        next === "free"
          ? "Você voltou para o plano gratuito."
          : `Plano ${PLAN_LABEL[next]} ativado! 🎉`,
      );
    } else {
      toast.error("Não consegui atualizar seu plano. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">

      <main className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
        <header className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.25em] text-cream/40">assinatura</p>
          <h1 className="font-display italic text-4xl lg:text-5xl text-blush mt-3 leading-tight">
            escolha como quer cozinhar
          </h1>
          <p className="text-cream/60 mt-4 leading-relaxed">
            Todo mundo começa no plano gratuito. Suba de plano quando quiser conversar sem limite
            com o Chef Despensa, fotografar sua geladeira ou receber um cardápio sob medida.
          </p>
          {session && !loading && (
            <p className="text-sm text-cream/50 mt-4">
              Plano atual:{" "}
              <span className="text-blush">{PLAN_LABEL[tier]}</span>
              {currentPeriodEnd &&
                ` · renova em ${new Date(currentPeriodEnd).toLocaleDateString("pt-BR")}`}
            </p>
          )}
        </header>

        <div className="grid gap-6 md:grid-cols-3 mt-12">
          {PLANS.map((plan) => {
            const isCurrent = session && plan.tier === tier;
            return (
              <div
                key={plan.tier}
                className={`relative flex flex-col rounded-2xl border p-7 transition ${
                  plan.highlight
                    ? "border-blush/60 bg-blush/[0.06]"
                    : "border-border bg-cream/[0.02]"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-blush px-3 py-1 text-[11px] font-medium text-charcoal">
                    mais escolhido
                  </span>
                )}

                <div className="text-3xl">{plan.emoji}</div>
                <h2 className="font-display italic text-2xl text-blush mt-3">{plan.name}</h2>
                <p className="text-sm text-cream/50 mt-1">{plan.tagline}</p>

                <div className="mt-6 flex items-end gap-2">
                  <span className="text-3xl text-cream">{plan.price}</span>
                  <span className="text-xs text-cream/40 pb-1">{plan.priceNote}</span>
                </div>

                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex gap-2.5 text-sm">
                      {f.included ? (
                        <Check size={16} className="mt-0.5 shrink-0 text-blush" />
                      ) : (
                        <X size={16} className="mt-0.5 shrink-0 text-cream/25" />
                      )}
                      <span className={f.included ? "text-cream/80" : "text-cream/55"}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.tier)}
                  disabled={!!isCurrent || pending !== null}
                  className={`mt-8 rounded-full py-3 text-sm transition disabled:opacity-60 ${
                    plan.highlight
                      ? "bg-blush text-charcoal hover:bg-blush-deep"
                      : "border border-border text-cream/80 hover:border-blush hover:text-blush"
                  }`}
                >
                  {isCurrent
                    ? "seu plano atual"
                    : pending === plan.tier
                      ? "ativando..."
                      : !session
                        ? "criar conta"
                        : plan.tier === "free"
                          ? "voltar para o gratuito"
                          : `assinar ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <Link
            to="/foto"
            className="rounded-2xl border border-border p-6 hover:border-blush/50 transition"
          >
            <p className="text-2xl">📸</p>
            <h3 className="font-display italic text-xl text-blush mt-2">
              reconhecimento por foto
            </h3>
            <p className="text-sm text-cream/55 mt-1">
              Fotografe um ingrediente e receba uma receita na hora. Planos básico e premium.
            </p>
          </Link>
          <Link
            to="/dieta"
            className="rounded-2xl border border-border p-6 hover:border-blush/50 transition"
          >
            <p className="text-2xl">🥗</p>
            <h3 className="font-display italic text-xl text-blush mt-2">planos de dieta</h3>
            <p className="text-sm text-cream/55 mt-1">
              Cardápio de 7 dias com calorias, feito para o seu objetivo. Exclusivo premium.
            </p>
          </Link>
        </section>

        <p className="text-xs text-cream/55 mt-12">
          Projeto acadêmico — os dados do cartão são enviados por HTTPS ao gateway de pagamento e
          nunca ficam salvos aqui; guardamos só o identificador da transação.
        </p>
      </main>
    </div>
  );
}
