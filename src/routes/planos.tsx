import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Check, Loader2, Salad, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS, PLAN_ICONS, PLAN_LABEL, type PlanTier } from "@/lib/plans";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function PlansPage() {
  const { session } = useAuth();
  const { tier, status, loading, changePlan, cancelSubscription, currentPeriodEnd } =
    useSubscription();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PlanTier | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const isFree = tier === "free";
  const isCanceled = status === "canceled";
  const periodEndsInFuture = Boolean(currentPeriodEnd && new Date(currentPeriodEnd) > new Date());
  // Enquanto a assinatura cancelada ainda vale, não dá pra trocar de plano —
  // só depois que o período atual encerrar de fato.
  const lockedByCancellation = isCanceled && periodEndsInFuture;
  // Com qualquer plano pago vigente — ativo OU cancelado mas ainda dentro do
  // período pago — o usuário precisa cancelar antes de trocar; não dá pra
  // pular direto de um plano pago pra outro. Só libera de novo quando volta
  // pro gratuito de verdade (nunca assinou, ou o período cancelado encerrou).
  const hasPaidPlan = !isFree;
  const canCancel = session && hasPaidPlan && !isCanceled;

  const handleSelect = async (next: PlanTier) => {
    if (!session) {
      navigate({ to: "/cadastro" });
      return;
    }
    if (next === tier) return;
    if (hasPaidPlan) return;
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
          : `Plano ${PLAN_LABEL[next]} ativado!`,
      );
    } else {
      toast.error("Não consegui atualizar seu plano. Tente novamente.");
    }
  };

  const handleCancel = async () => {
    setCancelBusy(true);
    const ok = await cancelSubscription();
    setCancelBusy(false);
    setConfirmOpen(false);
    if (ok) toast.success("Assinatura cancelada. Você mantém o acesso até o fim do período pago.");
    else toast.error("Não consegui cancelar sua assinatura. Tente novamente.");
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
        <header className="max-w-2xl">
          <h1 className="font-display italic text-4xl lg:text-5xl text-blush mt-3 leading-tight">
            Escolha como quer cozinhar
          </h1>
          <p className="text-cream/60 mt-4 leading-relaxed">
            Todo mundo começa no plano gratuito. Suba de plano quando quiser conversar sem limite
            com o Chef Despensa, fotografar sua geladeira ou receber um cardápio sob medida.
          </p>
          {session && !loading && (
            <p className="text-sm text-cream/50 mt-4">
              Plano atual: <span className="text-blush">{PLAN_LABEL[tier]}</span>
              {currentPeriodEnd && !isCanceled &&
                ` — renova em ${new Date(currentPeriodEnd).toLocaleDateString("pt-BR")}`}
            </p>
          )}

          {session && !loading && lockedByCancellation && currentPeriodEnd && (
            <p className="mt-4 rounded-xl border border-blush/25 bg-blush/[0.06] px-4 py-3 text-sm text-cream/70 max-w-xl">
              Sua assinatura do plano {PLAN_LABEL[tier]} foi cancelada e vale até{" "}
              {formatDate(currentPeriodEnd)}. A partir dessa data você poderá contratar outro
              plano — até lá seu plano atual continua ativo.
            </p>
          )}

          {session && !loading && hasPaidPlan && !lockedByCancellation && (
            <p className="mt-4 text-sm text-cream/45 max-w-xl">
              Para trocar de plano, cancele sua assinatura atual primeiro — o novo plano fica
              disponível assim que ela encerrar.
            </p>
          )}

          {session && !loading && canCancel && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="mt-4 text-sm text-cream/45 underline decoration-cream/20 underline-offset-4 transition hover:text-red-400 hover:decoration-red-400/50"
            >
              Cancelar assinatura
            </button>
          )}
        </header>

        <div className="grid gap-6 md:grid-cols-3 mt-12">
          {PLANS.map((plan) => {
            const isCurrent = session && plan.tier === tier;
            const isLocked = !isCurrent && hasPaidPlan;
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
                    Mais escolhido
                  </span>
                )}

                {(() => {
                  const I = PLAN_ICONS[plan.icon];
                  return <I className="h-7 w-7 text-blush" strokeWidth={1.25} />;
                })()}
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
                  disabled={!!isCurrent || isLocked || pending !== null}
                  title={
                    isLocked
                      ? lockedByCancellation && currentPeriodEnd
                        ? `Disponível a partir de ${formatDate(currentPeriodEnd)}`
                        : "Cancele sua assinatura atual para trocar de plano"
                      : undefined
                  }
                  className={`mt-8 rounded-full py-3 text-sm transition disabled:opacity-60 ${
                    plan.highlight
                      ? "bg-blush text-charcoal hover:bg-blush-deep"
                      : "border border-border text-cream/80 hover:border-blush hover:text-blush"
                  }`}
                >
                  {isCurrent
                    ? "seu plano atual"
                    : isLocked
                      ? "indisponível no momento"
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
            <Camera className="h-6 w-6 text-blush" strokeWidth={1.5} />
            <h3 className="font-display italic text-xl text-blush mt-2">Reconhecimento por foto</h3>
            <p className="text-sm text-cream/55 mt-1">
              Fotografe um ingrediente e receba uma receita na hora. Planos básico e premium.
            </p>
          </Link>
          <Link
            to="/dieta"
            className="rounded-2xl border border-border p-6 hover:border-blush/50 transition"
          >
            <Salad className="h-6 w-6 text-blush" strokeWidth={1.5} />
            <h3 className="font-display italic text-xl text-blush mt-2">Planos de dieta</h3>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md border-border bg-charcoal text-cream sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display italic text-2xl font-normal text-blush">
              Cancelar sua assinatura?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 leading-relaxed">
              {currentPeriodEnd
                ? `Você mantém o plano ${PLAN_LABEL[tier]} até ${formatDate(currentPeriodEnd)} e depois volta para o gratuito. Não haverá nova cobrança.`
                : "Você volta para o plano gratuito e não haverá nova cobrança."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={cancelBusy}
              className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream"
            >
              Manter assinatura
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleCancel();
              }}
              className="rounded-full bg-blush px-6 py-2.5 text-sm text-charcoal transition hover:bg-blush-deep"
            >
              {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
