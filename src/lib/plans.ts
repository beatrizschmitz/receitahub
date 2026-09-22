import type { LucideIcon } from "lucide-react";
import { ChefHat, Sparkles, Sprout } from "lucide-react";

export type PlanTier = "free" | "basico" | "premium";

export const FREE_CHAT_DAILY_LIMIT = 10;

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  /** Nome do ícone lucide que representa o plano (ver PLAN_ICONS). */
  icon: PlanIconName;
  highlight?: boolean;
  features: { label: string; included: boolean }[];
};

export const PLANS: PlanDefinition[] = [
  {
    tier: "free",
    name: "gratuito",
    price: "R$ 0",
    priceNote: "para sempre",
    tagline: "para começar a cozinhar sem desperdício",
    icon: "Sprout",
    features: [
      { label: "Despensa virtual com alertas de validade", included: true },
      { label: "Receitas geradas por IA", included: true },
      { label: `Chef Despensa: ${FREE_CHAT_DAILY_LIMIT} mensagens por dia`, included: true },
      { label: "Reconhecimento de ingredientes por foto", included: false },
      { label: "Planos de dieta personalizados", included: false },
    ],
  },
  {
    tier: "basico",
    name: "básico",
    price: "R$ 14,90",
    priceNote: "por mês",
    tagline: "para quem conversa muito com o chef",
    icon: "ChefHat",
    highlight: true,
    features: [
      { label: "Tudo do plano gratuito", included: true },
      { label: "Chef Despensa ilimitado", included: true },
      { label: "Reconhecimento de ingredientes por foto", included: true },
      { label: "Receita instantânea a partir da foto", included: true },
      { label: "Planos de dieta personalizados", included: false },
    ],
  },
  {
    tier: "premium",
    name: "premium",
    price: "R$ 29,90",
    priceNote: "por mês",
    tagline: "para quem quer um cardápio sob medida",
    icon: "Sparkles",
    features: [
      { label: "Tudo do plano básico", included: true },
      { label: "Planos de dieta personalizados por IA", included: true },
      { label: "Cardápio semanal com calorias por refeição", included: true },
      { label: "Restrições alimentares e objetivos", included: true },
      { label: "Histórico de planos salvos", included: true },
    ],
  },
];

export const PLAN_LABEL: Record<PlanTier, string> = {
  free: "gratuito",
  basico: "básico",
  premium: "premium",
};

// Ícone por plano, no lugar do emoji: mantém a distinção visual sem o tom casual.
export const PLAN_ICONS = { Sprout, ChefHat, Sparkles } satisfies Record<string, LucideIcon>;
export type PlanIconName = keyof typeof PLAN_ICONS;

export const PLAN_ICON: Record<PlanTier, PlanIconName> = {
  free: "Sprout",
  basico: "ChefHat",
  premium: "Sparkles",
};

const RANK: Record<PlanTier, number> = { free: 0, basico: 1, premium: 2 };

export function planAtLeast(tier: PlanTier, minimum: PlanTier) {
  return RANK[tier] >= RANK[minimum];
}

// Nome do plano com inicial maiúscula, para textos corridos ("plano Básico")
export const PLAN_TITLE: Record<PlanTier, string> = {
  free: "Gratuito",
  basico: "Básico",
  premium: "Premium",
};

// Funcionalidades exclusivas de planos pagos e o plano mínimo de cada uma.
// Serve de fonte única para o gate reutilizável (usePlanGate).
// "foto" não tem página própria: vive dentro do chat do Chef Despensa.
export type GatedFeature = "foto" | "dieta";

export const GATED_FEATURES: Record<GatedFeature, { minimum: PlanTier }> = {
  foto: { minimum: "basico" },
  dieta: { minimum: "premium" },
};

export type SubscriptionStatus = "active" | "canceled" | "expired";

/**
 * Plano que vale de fato para o usuário. Uma assinatura cancelada continua
 * valendo até o fim do período já pago; depois disso cai para o gratuito.
 * A mesma regra roda no cliente, nos server functions e no edge function do
 * chat — se mudar aqui, espelhe em supabase/functions/pantry-chat/index.ts.
 */
export function effectiveTier(
  planTier: PlanTier | string | null | undefined,
  status: SubscriptionStatus | string | null | undefined,
  currentPeriodEnd: string | null | undefined,
  now: Date = new Date(),
): PlanTier {
  const tier = (planTier ?? "free") as PlanTier;
  if (status === "active") return tier;
  if (status === "canceled" && currentPeriodEnd && new Date(currentPeriodEnd) > now) return tier;
  return "free";
}
