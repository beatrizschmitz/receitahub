import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const paymentSchema = z.object({
  planTier: z.enum(["basico", "premium"]),
  fullName: z.string().trim().min(3).max(120),
  cpf: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 11, {
    message: "CPF inválido",
  }),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 11, { message: "Telefone inválido" }),
  // dados sensíveis: usados apenas em memória para chamar o gateway, nunca persistidos
  cardNumber: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 13 && v.length <= 19),
  cardHolder: z.string().trim().min(3).max(120),
  cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/, "Validade inválida"),
  cardCvv: z.string().regex(/^\d{3,4}$/, "CVV inválido"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export type PaymentResult =
  | { approved: true; transactionId: string; planTier: "basico" | "premium"; periodEnd: string }
  | { approved: false; message: string };

// DEMO: período de cobrança encurtado pra 1 minuto (era 30 dias) só pra dar
// pra mostrar pro professor o ciclo cancelar → esperar → trocar de plano sem
// esperar um mês de verdade. Voltar pra 30 dias (30 * 864e5) antes de produção.
const BILLING_PERIOD_MS = 60 * 1000;

function luhnValid(number: string) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function expiryValid(expiry: string) {
  const [mm, yy] = expiry.split("/").map(Number);
  if (!mm || mm < 1 || mm > 12) return false;
  const now = new Date();
  const year = 2000 + (yy ?? 0);
  const endOfMonth = new Date(year, mm, 1);
  return endOfMonth > now;
}

/**
 * Envia a cobrança ao gateway de pagamento por HTTPS e devolve apenas o
 * identificador da transação. Nenhum dado de cartão é gravado (PCI-DSS).
 * Enquanto o gateway real não está contratado, usamos um autorizador
 * simulado com o mesmo contrato (aprovação/recusa + id da transação).
 */
async function chargeGateway(input: PaymentInput): Promise<PaymentResult> {
  const gatewayUrl = process.env["PAYMENT_GATEWAY_URL"];
  const gatewayKey = process.env["PAYMENT_GATEWAY_KEY"];

  if (gatewayUrl && gatewayKey) {
    const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/charges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayKey}`,
      },
      body: JSON.stringify({
        amount_plan: input.planTier,
        customer: { name: input.fullName, document: input.cpf, email: input.email, phone: input.phone },
        card: {
          number: input.cardNumber,
          holder: input.cardHolder,
          expiry: input.cardExpiry,
          cvv: input.cardCvv,
        },
      }),
    });
    if (!response.ok) return { approved: false, message: "Pagamento recusado pelo gateway." };
    const payload = (await response.json()) as { id?: string; status?: string };
    if (payload.status !== "approved" || !payload.id) {
      return { approved: false, message: "Pagamento recusado pela operadora do cartão." };
    }
    return {
      approved: true,
      transactionId: payload.id,
      planTier: input.planTier,
      periodEnd: new Date(Date.now() + BILLING_PERIOD_MS).toISOString(),
    };
  }

  // autorizador simulado
  await new Promise((r) => setTimeout(r, 1200));
  if (!luhnValid(input.cardNumber)) {
    return { approved: false, message: "Número do cartão inválido. Confira os dígitos." };
  }
  if (!expiryValid(input.cardExpiry)) {
    return { approved: false, message: "Cartão vencido. Use outro cartão." };
  }
  if (input.cardNumber.endsWith("0002")) {
    return { approved: false, message: "Pagamento recusado pela operadora do cartão." };
  }
  const transactionId = `sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  return {
    approved: true,
    transactionId,
    planTier: input.planTier,
    periodEnd: new Date(Date.now() + BILLING_PERIOD_MS).toISOString(),
  };
}

export const payForPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => paymentSchema.parse(data))
  .handler(async ({ data, context }): Promise<PaymentResult> => {
    const result = await chargeGateway(data);
    if (!result.approved) return result;

    const { error } = await context.supabase.from("subscriptions").upsert(
      {
        user_id: context.userId,
        plan_tier: result.planTier,
        status: "active",
        current_period_end: result.periodEnd,
        payment_provider_id: result.transactionId,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("subscriptions upsert", error.message);
      return {
        approved: false,
        message: "Cobrança autorizada, mas não conseguimos ativar o plano. Fale com o suporte.",
      };
    }
    return result;
  });
