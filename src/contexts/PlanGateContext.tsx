import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  GATED_FEATURES,
  PLAN_TITLE,
  planAtLeast,
  type GatedFeature,
  type PlanTier,
} from "@/lib/plans";

type PlanGateContextValue = {
  /**
   * Verifica se o plano atual libera a ação. Se não liberar, abre o modal de
   * assinatura e devolve `false` — o chamador simplesmente aborta.
   */
  requirePlan: (minimum: PlanTier) => boolean;
  /** Mesma checagem, a partir do nome da funcionalidade registrada em GATED_FEATURES. */
  requireFeature: (feature: GatedFeature) => boolean;
  /** Abre o modal diretamente (útil para estados de bloqueio já renderizados). */
  openUpgradeModal: (minimum?: PlanTier) => void;
};

const PlanGateContext = createContext<PlanGateContextValue | undefined>(undefined);

export function PlanGateProvider({ children }: { children: ReactNode }) {
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [requiredTier, setRequiredTier] = useState<PlanTier | null>(null);

  const openUpgradeModal = useCallback((minimum: PlanTier = "basico") => {
    setRequiredTier(minimum);
  }, []);

  const requirePlan = useCallback(
    (minimum: PlanTier) => {
      if (planAtLeast(tier, minimum)) return true;
      setRequiredTier(minimum);
      return false;
    },
    [tier],
  );

  const requireFeature = useCallback(
    (feature: GatedFeature) => requirePlan(GATED_FEATURES[feature].minimum),
    [requirePlan],
  );

  const value = useMemo(
    () => ({ requirePlan, requireFeature, openUpgradeModal }),
    [requirePlan, requireFeature, openUpgradeModal],
  );

  const close = () => setRequiredTier(null);

  return (
    <PlanGateContext.Provider value={value}>
      {children}

      <Dialog open={requiredTier !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-md border-border bg-charcoal text-cream sm:rounded-2xl">
          <DialogHeader className="text-center sm:text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-blush/40 bg-blush/10 mx-auto sm:mx-0">
              <Lock className="text-blush" size={20} />
            </div>
            <DialogTitle className="font-display italic text-2xl font-normal text-blush">
              Funcionalidade exclusiva de assinantes
            </DialogTitle>
            <DialogDescription className="text-cream/60 leading-relaxed">
              Essa função está disponível a partir do plano {PLAN_TITLE[requiredTier ?? "basico"]}.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="pill"
              onClick={close}
              className="border-border bg-transparent text-cream/70 hover:bg-transparent hover:text-cream"
            >
              Cancelar
            </Button>
            <Button
              size="pill"
              onClick={() => {
                close();
                void navigate({ to: "/planos" });
              }}
            >
              Ver planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlanGateContext.Provider>
  );
}

export function usePlanGate() {
  const ctx = useContext(PlanGateContext);
  if (!ctx) throw new Error("usePlanGate must be used inside PlanGateProvider");
  return ctx;
}
