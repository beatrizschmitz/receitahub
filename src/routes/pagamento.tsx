import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS, PLAN_LABEL, type PlanTier } from "@/lib/plans";
import { payForPlan } from "@/lib/payments.functions";

type PaidTier = Extract<PlanTier, "basico" | "premium">;

export const Route = createFileRoute("/pagamento")({
  component: PaymentPage,
  validateSearch: (search: Record<string, unknown>): { plan: PaidTier } => ({
    plan: search.plan === "premium" ? "premium" : "basico",
  }),
  head: () => ({
    meta: [
      { title: "Pagamento da assinatura — receitahub" },
      {
        name: "description",
        content:
          "Conclua a assinatura do plano básico ou premium do receitahub com pagamento seguro por cartão de crédito.",
      },
      { property: "og:title", content: "Pagamento da assinatura — receitahub" },
      {
        property: "og:description",
        content: "Finalize sua assinatura do receitahub em uma tela de pagamento segura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const inputClass =
  "w-full rounded-xl bg-cream/[0.04] border border-border px-4 py-3 text-sm text-cream placeholder:text-cream/45 outline-none focus:border-blush/60 transition";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function maskCard(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

function maskExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

function PaymentPage() {
  const { plan } = Route.useSearch();
  const { session, user, loading: authLoading } = useAuth();
  const { refresh } = useSubscription();
  const navigate = useNavigate();
  const charge = useServerFn(payForPlan);

  const planDef = PLANS.find((p) => p.tier === plan)!;

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ transactionId: string; periodEnd: string } | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  if (authLoading || !session) {
    return (
      <div className="min-h-screen bg-charcoal text-cream">
        <div className="py-24 text-center text-cream/50">Carregando...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 3) return setError("Informe seu nome completo.");
    if (cpf.replace(/\D/g, "").length !== 11) return setError("CPF deve ter 11 dígitos.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("E-mail inválido.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Telefone inválido.");
    if (cardNumber.replace(/\D/g, "").length < 13) return setError("Número do cartão incompleto.");
    if (cardHolder.trim().length < 3) return setError("Informe o nome impresso no cartão.");
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return setError("Validade no formato MM/AA.");
    if (!/^\d{3,4}$/.test(cardCvv)) return setError("CVV inválido.");

    setBusy(true);
    try {
      const result = await charge({
        data: {
          planTier: plan,
          fullName: fullName.trim(),
          cpf,
          email: email.trim(),
          phone,
          cardNumber,
          cardHolder: cardHolder.trim(),
          cardExpiry,
          cardCvv,
        },
      });
      if (result.approved) {
        // limpa os dados do cartão da memória do formulário
        setCardNumber("");
        setCardHolder("");
        setCardExpiry("");
        setCardCvv("");
        await refresh();
        setConfirmed({ transactionId: result.transactionId, periodEnd: result.periodEnd });
        toast.success(`Plano ${PLAN_LABEL[plan]} ativado!`);
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível confirmar o pagamento. Verifique os dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-charcoal text-cream">
        <main className="max-w-2xl mx-auto px-6 py-20">
          <div className="rounded-3xl border border-blush/30 bg-cream/[0.03] p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blush text-charcoal grid place-items-center">
              <Check className="w-7 h-7" />
            </div>
            <h1 className="font-display italic text-3xl text-blush mt-6">Pagamento aprovado</h1>
            <p className="text-cream/65 mt-3 leading-relaxed">
              Sua assinatura <span className="text-blush">{PLAN_LABEL[plan]}</span> já está ativa.
              Renova em {new Date(confirmed.periodEnd).toLocaleDateString("pt-BR")}.
            </p>
            <p className="text-xs text-cream/55 mt-4 font-mono break-all">
              Transação: {confirmed.transactionId}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link
                to="/receitas"
                className="rounded-full bg-blush text-charcoal px-6 py-3 text-sm hover:bg-blush-deep transition"
              >
                Começar a cozinhar
              </Link>
              <Link
                to="/planos"
                className="rounded-full border border-border px-6 py-3 text-sm text-cream/80 hover:border-blush hover:text-blush transition"
              >
                Ver minha assinatura
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-5xl mx-auto px-6 lg:px-10 py-16">
        <header className="max-w-2xl">
          <p className="text-sm text-cream/40">pagamento</p>
          <h1 className="font-display italic text-4xl text-blush mt-3 leading-tight">
            Concluir assinatura
          </h1>
          <p className="text-cream/60 mt-4 leading-relaxed">
            Plano <span className="text-blush">{planDef.name}</span> — {planDef.price}{" "}
            {planDef.priceNote}.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] mt-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="rounded-2xl border border-border p-6">
              <h2 className="font-display italic text-xl text-blush">Dados pessoais</h2>
              <div className="grid gap-4 sm:grid-cols-2 mt-5">
                <label className="sm:col-span-2 block">
                  <span className="text-sm text-cream/45">nome completo</span>
                  <input
                    className={`${inputClass} mt-2`}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Maria Silva"
                    autoComplete="name"
                    maxLength={120}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-cream/45">cpf</span>
                  <input
                    className={`${inputClass} mt-2`}
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-cream/45">telefone</span>
                  <input
                    className={`${inputClass} mt-2`}
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(71) 90000-0000"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </label>
                <label className="sm:col-span-2 block">
                  <span className="text-sm text-cream/45">e-mail</span>
                  <input
                    className={`${inputClass} mt-2`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    maxLength={255}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-border p-6">
              <div className="flex items-center gap-2">
                <h2 className="font-display italic text-xl text-blush">Dados do cartão</h2>
                <Lock className="w-4 h-4 text-cream/55" />
              </div>
              <p className="text-xs text-cream/40 mt-2">
                Enviados por HTTPS direto para o gateway de pagamento. Nunca ficam salvos no
                receitahub.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 mt-5">
                <label className="sm:col-span-2 block">
                  <span className="text-sm text-cream/45">número do cartão</span>
                  <input
                    className={`${inputClass} mt-2 font-mono`}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(maskCard(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                </label>
                <label className="sm:col-span-2 block">
                  <span className="text-sm text-cream/45">nome impresso no cartão</span>
                  <input
                    className={`${inputClass} mt-2`}
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    placeholder="MARIA SILVA"
                    autoComplete="cc-name"
                    maxLength={120}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-cream/45">validade (MM/AA)</span>
                  <input
                    className={`${inputClass} mt-2 font-mono`}
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                    placeholder="12/29"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-cream/45">cvv</span>
                  <input
                    className={`${inputClass} mt-2 font-mono`}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                  />
                </label>
              </div>
            </section>

            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 light:border-red-600/50 light:bg-red-50 light:text-red-800">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-blush text-charcoal px-7 py-3 text-sm hover:bg-blush-deep transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "processando pagamento..." : "confirmar pagamento"}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/planos" })}
                disabled={busy}
                className="rounded-full border border-border px-7 py-3 text-sm text-cream/80 hover:border-blush hover:text-blush transition disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </form>

          <aside className="rounded-2xl border border-border p-6 h-fit lg:sticky lg:top-24">
            <h2 className="font-display italic text-xl text-blush">Resumo</h2>
            <div className="flex items-baseline justify-between mt-5">
              <span className="text-cream/60 text-sm">Plano {planDef.name}</span>
              <span className="text-cream text-lg">{planDef.price}</span>
            </div>
            <p className="text-xs text-cream/55 mt-1">
              {planDef.priceNote} — cancele quando quiser
            </p>
            <ul className="space-y-2 mt-6">
              {planDef.features
                .filter((f) => f.included)
                .map((f) => (
                  <li key={f.label} className="flex gap-2 text-sm text-cream/65">
                    <Check className="w-4 h-4 text-blush shrink-0 mt-0.5" />
                    {f.label}
                  </li>
                ))}
            </ul>
            <p className="flex items-start gap-2 text-xs text-cream/40 mt-6 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-blush/70 shrink-0 mt-0.5" />
              Conexão criptografada. Guardamos apenas o identificador da transação retornado pelo
              gateway.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
