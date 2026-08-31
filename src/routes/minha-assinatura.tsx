import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS, PLAN_EMOJI, PLAN_LABEL } from "@/lib/plans";
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

export const Route = createFileRoute("/minha-assinatura")({
  component: SubscriptionPage,
  head: () => ({
    meta: [
      { title: "Minha assinatura — receitahub" },
      {
        name: "description",
        content: "Veja seu plano atual, status da assinatura e data de renovação no receitahub.",
      },
      { property: "og:title", content: "Minha assinatura — receitahub" },
      {
        property: "og:description",
        content: "Gerencie seu plano do receitahub: troque de plano ou cancele quando quiser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  active: "ativa",
  canceled: "cancelada",
  expired: "expirada",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function SubscriptionPage() {
  const { session, loading: authLoading } = useAuth();
  const { tier, status, currentPeriodEnd, loading, cancelSubscription } = useSubscription();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

  if (authLoading || !session || loading) {
    return (
      <div className="min-h-screen bg-charcoal text-cream">
        <div className="py-24 text-center text-cream/50">carregando...</div>
      </div>
    );
  }

  const plan = PLANS.find((p) => p.tier === tier);
  const isFree = tier === "free";
  const isCanceled = status === "canceled";
  const periodEndsInFuture = Boolean(currentPeriodEnd && new Date(currentPeriodEnd) > new Date());
  // Só faz sentido cancelar uma assinatura paga que ainda está de pé
  const canCancel = !isFree && !isCanceled;

  const handleCancel = async () => {
    setBusy(true);
    const ok = await cancelSubscription();
    setBusy(false);
    setConfirmOpen(false);
    if (ok) toast.success("Assinatura cancelada. Você mantém o acesso até o fim do período pago.");
    else toast.error("Não consegui cancelar sua assinatura. Tente novamente.");
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-3xl mx-auto px-6 lg:px-10 py-14">
        <p className="text-xs uppercase tracking-[0.25em] text-cream/40">assinatura</p>
        <h1 className="font-display italic text-4xl text-blush mt-3">minha assinatura</h1>
        <p className="text-cream/60 mt-3">
          Acompanhe seu plano, o status da cobrança e mude quando quiser.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-cream/[0.02] p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">{PLAN_EMOJI[tier]}</span>
                <div>
                  <h2 className="font-display italic text-2xl text-blush">{PLAN_LABEL[tier]}</h2>
                  {plan && (
                    <p className="text-sm text-cream/45">
                      {plan.price}
                      <span className="text-cream/55"> · {plan.priceNote}</span>
                    </p>
                  )}
                </div>
              </div>
              {plan && <p className="text-sm text-cream/50 mt-3">{plan.tagline}</p>}
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                isCanceled
                  ? "border-blush/40 bg-blush/10 text-blush"
                  : status === "expired"
                    ? "border-border text-cream/45"
                    : "border-green-500/40 bg-green-500/10 text-green-400"
              }`}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>

          <dl className="mt-7 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-cream/55">status</dt>
              <dd className="mt-1.5 text-sm text-cream/80">
                {isFree
                  ? "Plano gratuito, sem cobrança"
                  : isCanceled
                    ? "Cancelada — não haverá nova cobrança"
                    : "Ativa e renovando automaticamente"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-cream/55">
                {isCanceled ? "acesso até" : "próxima renovação"}
              </dt>
              <dd className="mt-1.5 text-sm text-cream/80">
                {isFree || !currentPeriodEnd ? (
                  <span className="text-cream/40">—</span>
                ) : (
                  formatDate(currentPeriodEnd)
                )}
              </dd>
            </div>
          </dl>

          {isCanceled && periodEndsInFuture && currentPeriodEnd && (
            <p className="mt-5 rounded-xl border border-blush/25 bg-blush/[0.06] px-4 py-3 text-sm text-cream/70">
              Você continua com o plano {PLAN_LABEL[tier]} até {formatDate(currentPeriodEnd)}.
              Depois disso sua conta volta para o gratuito.
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/planos"
              className="inline-flex items-center gap-2 rounded-full bg-blush px-6 py-2.5 text-sm text-charcoal transition hover:bg-blush-deep"
            >
              <CreditCard size={16} />
              {isFree ? "ver planos" : "trocar de plano"}
            </Link>
            {canCancel && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="rounded-full border border-border px-6 py-2.5 text-sm text-cream/60 transition hover:border-red-400/50 hover:text-red-400"
              >
                cancelar assinatura
              </button>
            )}
          </div>
        </section>

        {isFree && (
          <p className="mt-6 text-sm text-cream/45">
            Você está no plano gratuito. Assine o básico para conversar sem limites com o Chef
            Despensa e fotografar ingredientes.
          </p>
        )}
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
              disabled={busy}
              className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream"
            >
              Manter assinatura
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleCancel();
              }}
              className="rounded-full bg-blush px-6 py-2.5 text-sm text-charcoal transition hover:bg-blush-deep"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
