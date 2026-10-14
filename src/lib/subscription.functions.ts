import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { effectiveTier } from "@/lib/plans";

// A tabela `subscriptions` NÃO aceita mais escrita feita pelo navegador (ver
// supabase/migrations/20261014120000_lock_subscriptions.sql): antes, qualquer
// pessoa conseguia se dar o plano Premium sem pagar com um upsert no console.
// Toda mudança de assinatura passa por aqui (ou por payForPlan, no pagamento),
// com o service role, depois de checar quem é o usuário e o que ele já tem.

export type SubscriptionActionResult = { ok: true } | { ok: false; message: string };

async function currentSubscription(userId: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_tier, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Cancela a assinatura paga. O acesso continua até o fim do período já pago
 * (current_period_end não é alterado).
 */
export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionActionResult> => {
    const sub = await currentSubscription(context.userId);
    const tier = effectiveTier(sub?.plan_tier, sub?.status, sub?.current_period_end);
    if (!sub || tier === "free" || sub.status !== "active") {
      return { ok: false, message: "Você não tem uma assinatura ativa para cancelar." };
    }
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", context.userId);
    if (error) {
      console.error("cancelMySubscription", error.message);
      return { ok: false, message: "Não consegui cancelar sua assinatura." };
    }
    return { ok: true };
  });

/**
 * Volta para o plano gratuito. Só vale quando não há plano pago vigente — quem
 * tem assinatura ativa (ou cancelada, mas ainda dentro do período pago) precisa
 * esperar o fim do período. Nunca concede plano pago: isso só acontece em
 * payForPlan, depois de o gateway aprovar a cobrança.
 */
export const downgradeToFree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionActionResult> => {
    const sub = await currentSubscription(context.userId);
    const tier = effectiveTier(sub?.plan_tier, sub?.status, sub?.current_period_end);
    if (tier !== "free") {
      return { ok: false, message: "Cancele a assinatura e aguarde o fim do período pago." };
    }
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        plan_tier: "free",
        status: "active",
        current_period_end: null,
        payment_provider_id: null,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("downgradeToFree", error.message);
      return { ok: false, message: "Não consegui atualizar seu plano." };
    }
    return { ok: true };
  });
