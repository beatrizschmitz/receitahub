import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/lista-compras")({
  component: ShoppingListPage,
  head: () => ({
    meta: [
      { title: "Lista de compras — receitahub" },
      {
        name: "description",
        content:
          "Sua lista de compras é gerada automaticamente a partir dos itens vencidos ou prestes a vencer da despensa.",
      },
    ],
  }),
});

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  source: string;
  is_purchased: boolean;
};

type PantryRow = {
  name: string;
  category: string | null;
  quantity: string | null;
  expires_in: number;
  expires_at: string | null;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysUntil(dateISO: string) {
  const today = new Date(todayISO() + "T00:00:00");
  const target = new Date(dateISO + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function sourceBadge(source: string) {
  if (source === "expired")
    return { label: "vencido", className: "bg-red-500/20 text-red-400 border-red-500/30" };
  if (source === "expiring")
    return { label: "vencendo", className: "bg-blush/20 text-blush border-blush/30" };
  return { label: "manual", className: "bg-cream/10 text-cream/70 border-border" };
}

function ShoppingListPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/login" });
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    void syncAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function syncAndLoad() {
    setLoading(true);
    try {
      // 1. Pull pantry items
      const { data: pantry } = await supabase
        .from("pantry_items")
        .select("name, category, quantity, expires_in, expires_at");

      // 2. Pull existing unpurchased shopping items to avoid duplicates
      const { data: existing } = await supabase
        .from("shopping_list_items")
        .select("name, is_purchased")
        .eq("is_purchased", false);

      const existingNames = new Set((existing ?? []).map((r) => r.name.toLowerCase()));

      const toInsert: Array<{
        user_id: string;
        name: string;
        category: string | null;
        quantity: string | null;
        source: "expired" | "expiring";
      }> = [];

      for (const p of (pantry ?? []) as PantryRow[]) {
        const days = p.expires_at ? daysUntil(p.expires_at) : p.expires_in;
        let source: "expired" | "expiring" | null = null;
        if (days < 0) source = "expired";
        else if (days <= 5) source = "expiring";
        if (!source) continue;
        if (existingNames.has(p.name.toLowerCase())) continue;
        toInsert.push({
          user_id: session!.user.id,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          source,
        });
        existingNames.add(p.name.toLowerCase());
      }

      if (toInsert.length > 0) {
        await supabase.from("shopping_list_items").insert(toInsert);
      }

      // 3. Load full list
      const { data, error } = await supabase
        .from("shopping_list_items")
        .select("id, name, category, quantity, source, is_purchased")
        .order("is_purchased", { ascending: true })
        .order("created_at", { ascending: false });

      if (!error && data) setItems(data as ShopItem[]);
    } finally {
      setLoading(false);
    }
  }

  async function togglePurchased(item: ShopItem) {
    const next = !item.is_purchased;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_purchased: next } : i)));
    await supabase.from("shopping_list_items").update({ is_purchased: next }).eq("id", item.id);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("shopping_list_items").delete().eq("id", id);
  }

  async function clearPurchased() {
    const ids = items.filter((i) => i.is_purchased).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((i) => !i.is_purchased));
    await supabase.from("shopping_list_items").delete().in("id", ids);
    toast.success(`${ids.length} item(ns) removidos`);
  }

  function copyList() {
    const pending = items.filter((i) => !i.is_purchased);
    if (pending.length === 0) {
      toast.info("Nenhum item pendente para copiar");
      return;
    }
    const text = pending
      .map((i) => `- ${i.name}${i.quantity ? ` (${i.quantity})` : ""}`)
      .join("\n");
    navigator.clipboard.writeText(`Lista de compras:\n${text}`);
    toast.success("Lista copiada!");
  }

  if (authLoading || !session) {
    return (
      <div className="min-h-screen bg-charcoal text-cream flex items-center justify-center">
        <div className="text-cream/50">Carregando...</div>
      </div>
    );
  }

  const pending = items.filter((i) => !i.is_purchased);
  const purchased = items.filter((i) => i.is_purchased);

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap"
      />

      <section className="max-w-5xl mx-auto px-6 lg:px-10 pt-20 pb-12">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="text-sm text-blush mb-3">gerada automaticamente</div>
            <h1 className="text-5xl md:text-6xl text-cream leading-tight">
              Lista de <em className="text-blush font-display italic">compras</em>
            </h1>
            <p className="mt-4 text-cream/70 max-w-xl">
              Itens vencidos ou prestes a vencer da sua despensa aparecem aqui automaticamente. Você
              também pode adicionar manualmente.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={copyList}
              className="px-5 py-2.5 rounded-full border border-blush/40 text-blush hover:bg-blush hover:text-charcoal transition text-sm"
            >
              Copiar lista
            </button>
            {purchased.length > 0 && (
              <button
                onClick={clearPurchased}
                className="px-5 py-2.5 rounded-full border border-border text-cream/70 hover:text-cream hover:border-blush/40 transition text-sm"
              >
                Limpar comprados ({purchased.length})
              </button>
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-4">
          <div className="bg-charcoal-light rounded-2xl p-5 border border-border">
            <div className="text-sm text-cream/50">a comprar</div>
            <div className="font-display text-3xl text-cream mt-2">{pending.length}</div>
          </div>
          <div className="bg-blush/10 rounded-2xl p-5 border border-blush/30">
            <div className="text-sm text-blush">automáticos</div>
            <div className="font-display text-3xl text-blush mt-2">
              {pending.filter((i) => i.source !== "manual").length}
            </div>
          </div>
          <div className="bg-emerald-500/10 light:bg-emerald-50 rounded-2xl p-5 border border-emerald-500/30 light:border-emerald-600/40">
            <div className="text-sm text-emerald-300 light:text-emerald-800">comprados</div>
            <div className="font-display text-3xl text-emerald-300 light:text-emerald-800 mt-2">
              {purchased.length}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 lg:px-10 pb-24">
        {loading ? (
          <div className="text-center py-16 text-cream/50">Carregando lista...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-3xl">
            <ShoppingCart className="mx-auto mb-4 h-9 w-9 text-cream/25" strokeWidth={1} />
            <h3 className="font-display text-2xl text-cream mb-2">Sua lista está vazia</h3>
            <p className="text-cream/60">
              Quando algum item da sua despensa estiver vencido ou perto da validade, ele aparece
              aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const badge = sourceBadge(item.source);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition ${
                    item.is_purchased
                      ? "bg-charcoal/40 border-border opacity-60"
                      : "bg-charcoal-light border-border hover:border-blush/40"
                  }`}
                >
                  <button
                    onClick={() => togglePurchased(item)}
                    className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${
                      item.is_purchased
                        ? "bg-blush border-blush text-charcoal"
                        : "border-cream/30 hover:border-blush"
                    }`}
                    aria-label={
                      item.is_purchased ? "Desmarcar como comprado" : "Marcar como comprado"
                    }
                  >
                    {item.is_purchased && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="h-3 w-3"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-cream ${
                          item.is_purchased ? "line-through text-cream/50" : ""
                        }`}
                      >
                        {item.name}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-cream/50 mt-0.5">
                      {item.category || "—"}
                      {item.quantity && ` — ${item.quantity}`}
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-cream/40 hover:text-red-400 transition text-xs"
                    aria-label="Remover"
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
