import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  FREE_CHAT_DAILY_LIMIT,
  effectiveTier,
  planAtLeast,
  type PlanTier,
  type SubscriptionStatus,
} from "@/lib/plans";

type SubscriptionContextValue = {
  tier: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  loading: boolean;
  chatUsedToday: number;
  chatLimit: number | null;
  chatRemaining: number | null;
  canChat: boolean;
  hasPhotoRecognition: boolean;
  hasDietPlans: boolean;
  refresh: () => Promise<void>;
  registerChatMessage: () => Promise<void>;
  changePlan: (tier: PlanTier) => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

// A contagem diária é gravada com CURRENT_DATE do banco (UTC), então o cliente
// usa a mesma referência para ler e para virar o dia.
function today() {
  return new Date().toISOString().slice(0, 10);
}

function msUntilNextReset() {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    1,
  );
  return nextMidnight - now.getTime();
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<PlanTier>("free");
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [chatUsedToday, setChatUsedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTier("free");
      setStatus("active");
      setCurrentPeriodEnd(null);
      setChatUsedToday(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: sub }, { data: usage }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_tier, status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("chat_usage")
        .select("message_count")
        .eq("user_id", user.id)
        .eq("reference_date", today())
        .maybeSingle(),
    ]);

    if (sub) {
      setTier(effectiveTier(sub.plan_tier, sub.status, sub.current_period_end));
      setStatus(sub.status as SubscriptionStatus);
      setCurrentPeriodEnd(sub.current_period_end);
    } else {
      // usuário antigo sem registro: cria plano gratuito
      await supabase.from("subscriptions").insert({ user_id: user.id, plan_tier: "free" });
      setTier("free");
    }
    setChatUsedToday(usage?.message_count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Zera a contagem automaticamente na virada do dia, sem precisar recarregar a página
  useEffect(() => {
    const timer = setTimeout(() => {
      setChatUsedToday(0);
      void refresh();
    }, msUntilNextReset());
    return () => clearTimeout(timer);
  }, [refresh]);

  const registerChatMessage = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("increment_chat_usage");
    if (!error && typeof data === "number") setChatUsedToday(data);
    else setChatUsedToday((n) => n + 1);
  }, [user]);

  // DEMO: período de cobrança encurtado pra 1 minuto (era 30 dias) só pra dar
  // pra mostrar pro professor o ciclo cancelar → esperar → trocar de plano
  // sem esperar um mês de verdade. Voltar pra 30 dias antes de ir pra produção.
  const BILLING_PERIOD_MS = 60 * 1000;

  const changePlan = useCallback(
    async (next: PlanTier) => {
      if (!user) return false;
      const periodEnd =
        next === "free" ? null : new Date(Date.now() + BILLING_PERIOD_MS).toISOString();
      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          plan_tier: next,
          status: "active",
          current_period_end: periodEnd,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        console.error("changePlan", error);
        return false;
      }
      setTier(next);
      setStatus("active");
      setCurrentPeriodEnd(periodEnd);
      return true;
    },
    [user],
  );

  // Cancelar preserva current_period_end: o acesso pago vale até lá
  const cancelSubscription = useCallback(async () => {
    if (!user) return false;
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id);
    if (error) {
      console.error("cancelSubscription", error);
      return false;
    }
    setStatus("canceled");
    setTier((current) => effectiveTier(current, "canceled", currentPeriodEnd));
    return true;
  }, [user, currentPeriodEnd]);

  const chatLimit = tier === "free" ? FREE_CHAT_DAILY_LIMIT : null;
  const chatRemaining = chatLimit === null ? null : Math.max(0, chatLimit - chatUsedToday);

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        status,
        currentPeriodEnd,
        loading,
        chatUsedToday,
        chatLimit,
        chatRemaining,
        canChat: chatRemaining === null || chatRemaining > 0,
        hasPhotoRecognition: planAtLeast(tier, "basico"),
        hasDietPlans: planAtLeast(tier, "premium"),
        refresh,
        registerChatMessage,
        changePlan,
        cancelSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return ctx;
}
