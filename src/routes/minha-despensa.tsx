import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/minha-despensa")({
  component: PantryPage,
  head: () => ({
    meta: [
      { title: "Minha despensa — receitahub" },
      {
        name: "description",
        content:
          "Gerencie seu estoque de ingredientes, controle datas de validade e evite o desperdício.",
      },
    ],
  }),
});

const CATEGORIES = [
  "Grãos",
  "Cereais",
  "Massas",
  "Frutas",
  "Vegetais",
  "Legumes",
  "Verduras",
  "Proteínas",
  "Carnes",
  "Peixes e Frutos do Mar",
  "Laticínios",
  "Ovos",
  "Pães",
  "Ervas",
  "Temperos",
  "Óleos",
  "Molhos e Condimentos",
  "Enlatados",
  "Congelados",
  "Doces e Açúcares",
  "Bebidas",
  "Snacks",
  "Outros",
];

type Item = {
  id: string;
  name: string;
  category: string;
  quantity: string | null;
  expires_in: number;
  purchased_at: string | null;
  expires_at: string | null;
};

// Associações nome -> categoria mais comuns na despensa brasileira. É uma
// sugestão local (sem IA): o campo continua editável e o primeiro grupo cuja
// palavra-chave aparece no nome digitado vence.
const CATEGORY_KEYWORDS: Array<[string[], string]> = [
  [["arroz", "aveia", "granola", "quinoa", "cevada", "milho de pipoca"], "Cereais"],
  [["feijao", "lentilha", "grao de bico", "ervilha seca", "soja em grao"], "Grãos"],
  [["macarrao", "espaguete", "lasanha", "nhoque", "massa", "talharim", "parafuso"], "Massas"],
  [
    [
      "banana", "maca", "laranja", "uva", "manga", "abacaxi", "morango", "limao",
      "mamao", "melancia", "pera", "abacate", "kiwi", "pessego", "ameixa", "melao",
      "tangerina", "goiaba", "coco",
    ],
    "Frutas",
  ],
  [
    [
      "tomate", "batata", "cebola", "alho", "cenoura", "abobrinha", "pepino",
      "pimentao", "beterraba", "abobora", "chuchu", "mandioca", "batata doce",
      "milho verde", "vagem",
    ],
    "Vegetais",
  ],
  [["alface", "couve", "espinafre", "rucula", "brocolis", "repolho", "agriao", "acelga"], "Verduras"],
  [
    [
      "frango", "carne moida", "carne bovina", "file", "bife", "costela",
      "picanha", "linguica", "bacon", "peru", "carne suina", "lombo", "presunto",
    ],
    "Carnes",
  ],
  [["peixe", "salmao", "tilapia", "camarao", "atum fresco", "bacalhau", "lula", "polvo", "sardinha fresca"], "Peixes e Frutos do Mar"],
  [["leite", "queijo", "iogurte", "manteiga", "requeijao", "creme de leite", "nata"], "Laticínios"],
  [["ovo"], "Ovos"],
  [["pao", "baguete", "torrada", "wrap", "tortilha"], "Pães"],
  [["manjericao", "salsa", "cebolinha", "coentro", "oregano", "alecrim", "hortela", "tomilho", "louro"], "Ervas"],
  [["sal", "pimenta do reino", "curcuma", "cominho", "canela", "paprica", "curry", "colorau", "noz moscada", "tempero"], "Temperos"],
  [["azeite", "oleo de soja", "oleo de girassol", "oleo de coco", "oleo"], "Óleos"],
  [["ketchup", "maionese", "mostarda", "molho de tomate", "shoyu", "molho barbecue", "vinagre", "molho"], "Molhos e Condimentos"],
  [["enlatado", "lata de", "milho em lata", "ervilha em lata", "sardinha em lata"], "Enlatados"],
  [["congelado", "sorvete", "nuggets", "polpa de fruta"], "Congelados"],
  [["acucar", "chocolate", "doce", "mel", "achocolatado", "geleia", "bolo pronto"], "Doces e Açúcares"],
  [["agua", "suco", "refrigerante", "cafe", "cha", "cerveja", "vinho", "refresco"], "Bebidas"],
  [["biscoito", "salgadinho", "pipoca", "amendoim", "castanha", "bolacha", "chips"], "Snacks"],
  [["whey", "tofu", "seitan", "proteina"], "Proteínas"],
];

function normalizeItemName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function suggestCategory(name: string): string | null {
  const normalized = normalizeItemName(name);
  if (!normalized.trim()) return null;
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => normalized.includes(k))) return category;
  }
  return null;
}

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDateBR(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function PantryPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "vencidos" | "vencendo" | "ok">(
    "todos",
  );
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    quantity: "",
    purchased_at: todayISO(),
    expires_at: "",
  });
  // Enquanto true, a categoria ainda não foi escolhida à mão e pode ser
  // atualizada pela sugestão automática. Vira false assim que o usuário
  // interage com o <select>, e a sugestão para de sobrescrever a escolha dele.
  const [categoryAuto, setCategoryAuto] = useState(true);
  const [quantityError, setQuantityError] = useState(false);

  const handleNameChange = (name: string) => {
    setNewItem((prev) => {
      if (!categoryAuto) return { ...prev, name };
      const suggested = suggestCategory(name);
      return suggested ? { ...prev, name, category: suggested } : { ...prev, name };
    });
  };

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/login" });
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pantry_items")
        .select("id, name, category, quantity, expires_in, purchased_at, expires_at")
        .order("created_at", { ascending: false });
      if (!error && data) setItems(data as Item[]);
      setLoading(false);
    })();
  }, [session]);

  if (authLoading || !session) {
    return (
      <div className="min-h-screen bg-charcoal text-cream flex items-center justify-center">
        <div className="text-cream/50">Carregando...</div>
      </div>
    );
  }

  const categories = ["todos", ...Array.from(new Set(items.map((i) => i.category)))];

  // "expiring" = vence em até 5 dias (usa expires_at se existir, senão expires_in)
  const today = todayISO();
  const computeDaysLeft = (item: Item): number => {
    if (item.expires_at) return daysBetween(today, item.expires_at);
    return item.expires_in;
  };
  const getStatus = (item: Item): "vencidos" | "vencendo" | "ok" => {
    const d = computeDaysLeft(item);
    if (d < 0) return "vencidos";
    if (d <= 5) return "vencendo";
    return "ok";
  };

  const expiredCount = items.filter((i) => getStatus(i) === "vencidos").length;
  const expiring = items.filter((i) => getStatus(i) === "vencendo").length;

  const filtered = items.filter((i) => {
    if (filter !== "todos" && i.category !== filter) return false;
    if (statusFilter !== "todos" && getStatus(i) !== statusFilter) return false;
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    if (!newItem.quantity.trim()) {
      setQuantityError(true);
      return;
    }
    setQuantityError(false);

    // Calcula expires_in (dias até vencer) se houver expires_at
    const expiresIn = newItem.expires_at
      ? Math.max(0, daysBetween(newItem.purchased_at || today, newItem.expires_at))
      : 7;

    const { data, error } = await supabase
      .from("pantry_items")
      .insert({
        user_id: session.user.id,
        name: newItem.name.trim(),
        category: newItem.category,
        quantity: newItem.quantity.trim(),
        expires_in: expiresIn,
        purchased_at: newItem.purchased_at || null,
        expires_at: newItem.expires_at || null,
      })
      .select("id, name, category, quantity, expires_in, purchased_at, expires_at")
      .single();
    if (!error && data) {
      setItems([data as Item, ...items]);
      setNewItem({
        name: "",
        category: "",
        quantity: "",
        purchased_at: todayISO(),
        expires_at: "",
      });
      setCategoryAuto(true);
      setShowForm(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("pantry_items").delete().eq("id", id);
    if (!error) setItems(items.filter((i) => i.id !== id));
  };

  const handleAddToShoppingList = async (item: Item) => {
    const { error } = await supabase.from("shopping_list_items").insert({
      user_id: session.user.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      source: "manual",
    });
    if (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap"
      />

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-12">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <h1 className="text-5xl md:text-6xl text-cream leading-tight">
              Minha <em className="text-blush font-display italic">despensa</em>
            </h1>
            <p className="mt-4 text-cream/70 max-w-xl">
              Tudo que você tem em casa, organizado. A IA usa esta lista para sugerir receitas
              personalizadas.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 rounded-full bg-blush text-charcoal text-sm font-medium hover:bg-blush-deep transition flex items-center gap-2"
          >
            <span className="text-lg leading-none">{showForm ? "×" : "+"}</span>
            {showForm ? "Cancelar" : "Adicionar item"}
          </button>
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter("todos")}
            className={`text-left bg-charcoal-light rounded-2xl p-5 border transition hover:border-blush/40 ${
              statusFilter === "todos" ? "border-blush" : "border-border"
            }`}
          >
            <div className="text-sm text-cream/50">Itens totais</div>
            <div className="font-display text-3xl text-cream mt-2">{items.length}</div>
          </button>
          <div className="bg-charcoal-light rounded-2xl p-5 border border-border">
            <div className="text-sm text-cream/50">Categorias</div>
            <div className="font-display text-3xl text-cream mt-2">
              {Math.max(0, categories.length - 1)}
            </div>
          </div>
          <button
            onClick={() => setStatusFilter("vencendo")}
            className={`text-left bg-blush/10 rounded-2xl p-5 border transition hover:bg-blush/15 ${
              statusFilter === "vencendo" ? "border-blush" : "border-blush/30"
            }`}
          >
            <div className="text-sm text-blush">Vencendo em breve</div>
            <div className="font-display text-3xl text-blush mt-2">{expiring}</div>
            <div className="text-[10px] uppercase tracking-wider text-blush/70 mt-1">
              próximos 5 dias
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("vencidos")}
            className={`text-left bg-red-500/10 light:bg-red-50 rounded-2xl p-5 border transition hover:bg-red-500/15 light:hover:bg-red-100 ${
              statusFilter === "vencidos"
                ? "border-red-400 light:border-red-600"
                : "border-red-500/30 light:border-red-600/40"
            }`}
          >
            <div className="text-sm text-red-400 light:text-red-800">Vencidos</div>
            <div className="font-display text-3xl text-red-400 light:text-red-800 mt-2">
              {expiredCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-red-400/70 mt-1">
              clique para filtrar
            </div>
          </button>
        </div>

        {/* Status filter pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              { key: "todos", label: "Todos os status", count: items.length },
              { key: "vencidos", label: "Vencidos", count: expiredCount },
              { key: "vencendo", label: "Vencendo em breve", count: expiring },
              { key: "ok", label: "Ok", count: items.length - expiredCount - expiring },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-4 py-2 rounded-full text-sm transition border flex items-center gap-2 ${
                statusFilter === s.key
                  ? "bg-blush text-charcoal border-blush"
                  : "border-border text-cream/70 hover:text-cream hover:border-blush/40"
              }`}
            >
              <span>{s.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === s.key ? "bg-charcoal/20" : "bg-charcoal/60"
                }`}
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="mt-8 bg-charcoal-light border border-blush/30 rounded-2xl p-6 grid md:grid-cols-6 gap-4 items-start"
          >
            {/* Todo campo fica dentro de um label com legenda + input, mesmo quando a
                legenda é invisível (nome/categoria/quantidade). É o que garante que os
                cinco inputs desta linha — incluindo os de data — tenham exatamente a
                mesma altura e fiquem alinhados: sem a legenda reservando o mesmo espaço,
                "Comprado em"/"Validade" empurram só os dois inputs de data para baixo. */}
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="invisible text-[11px] px-1">Ingrediente</span>
              <input
                required
                value={newItem.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ingrediente"
                maxLength={80}
                className="h-12 bg-charcoal border border-border rounded-xl px-4 text-cream placeholder:text-cream/40 focus:outline-none focus:border-blush/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="invisible text-[11px] px-1">Categoria</span>
              <select
                required
                value={newItem.category}
                onChange={(e) => {
                  setCategoryAuto(false);
                  setNewItem({ ...newItem, category: e.target.value });
                }}
                className={`h-12 bg-charcoal border border-border rounded-xl px-4 focus:outline-none focus:border-blush/50 ${
                  newItem.category ? "text-cream" : "text-cream/40"
                }`}
              >
                <option value="" disabled>
                  Categoria
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="text-cream">
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="invisible text-[11px] px-1">Quantidade</span>
              <input
                required
                value={newItem.quantity}
                onChange={(e) => {
                  setQuantityError(false);
                  setNewItem({ ...newItem, quantity: e.target.value });
                }}
                placeholder="Quantidade (ex: 2kg)"
                maxLength={40}
                aria-invalid={quantityError}
                className={`h-12 bg-charcoal border rounded-xl px-4 text-cream placeholder:text-cream/40 focus:outline-none ${
                  quantityError
                    ? "border-red-500 focus:border-red-500"
                    : "border-border focus:border-blush/50"
                }`}
              />
              {quantityError && (
                <span className="text-[11px] text-red-400 px-1">Informe a quantidade.</span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-cream/50 px-1">Comprado em</span>
              <input
                type="date"
                value={newItem.purchased_at}
                max={todayISO()}
                onChange={(e) => setNewItem({ ...newItem, purchased_at: e.target.value })}
                className="h-12 bg-charcoal border border-border rounded-xl px-4 text-cream focus:outline-none focus:border-blush/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-cream/50 px-1">Validade</span>
              <input
                type="date"
                value={newItem.expires_at}
                min={newItem.purchased_at || todayISO()}
                onChange={(e) => setNewItem({ ...newItem, expires_at: e.target.value })}
                className="h-12 bg-charcoal border border-border rounded-xl px-4 text-cream focus:outline-none focus:border-blush/50"
              />
            </label>
            <button
              type="submit"
              className="md:col-span-6 bg-blush text-charcoal font-medium rounded-xl px-4 py-3 hover:bg-blush-deep transition"
            >
              Adicionar à despensa
            </button>
          </form>
        )}

        {/* Category filters */}
        {items.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-4 py-2 rounded-full text-sm first-letter:uppercase transition border ${
                  filter === c
                    ? "bg-blush text-charcoal border-blush"
                    : "border-border text-cream/70 hover:text-cream hover:border-blush/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Items table */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
        {loading ? (
          <div className="text-center py-16 text-cream/50">Carregando despensa...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-3xl">
            <Package className="mx-auto mb-4 h-9 w-9 text-cream/25" strokeWidth={1} />
            <h3 className="font-display text-2xl text-cream mb-2">Sua despensa está vazia</h3>
            <p className="text-cream/60">
              Adicione seu primeiro ingrediente clicando em "Adicionar item".
            </p>
          </div>
        ) : (
          <div className="bg-charcoal-light border border-border rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 text-sm text-cream/50 border-b border-border">
              <div className="col-span-3">Item</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-2">Quantidade</div>
              <div className="col-span-2">Comprado</div>
              <div className="col-span-2">Validade</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>

            {filtered.map((item) => {
              const daysLeft = computeDaysLeft(item);
              const expired = daysLeft < 0;
              const urgent = !expired && daysLeft <= 3;
              const warning = !expired && !urgent && daysLeft <= 7;

              const validityLabel = expired
                ? `vencido há ${Math.abs(daysLeft)}d`
                : daysLeft === 0
                  ? "vence hoje"
                  : daysLeft === 1
                    ? "amanhã"
                    : daysLeft <= 30
                      ? `${daysLeft} dias`
                      : `${Math.round(daysLeft / 30)} meses`;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-5 items-center border-b border-border last:border-0 hover:bg-charcoal/50 transition group"
                >
                  <div className="col-span-2 md:col-span-3 flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        expired
                          ? "bg-red-500"
                          : urgent
                            ? "bg-blush animate-pulse"
                            : warning
                              ? "bg-blush/50"
                              : "bg-cream/20"
                      }`}
                    />
                    <span className="text-cream">{item.name}</span>
                  </div>
                  <div className="md:col-span-2 text-sm text-cream/60">{item.category}</div>
                  <div className="md:col-span-2 text-sm text-cream/80">{item.quantity || "—"}</div>
                  <div className="md:col-span-2 text-sm text-cream/60">
                    {formatDateBR(item.purchased_at)}
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <span className="text-xs text-cream/50">{formatDateBR(item.expires_at)}</span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full self-start ${
                        expired
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : urgent
                            ? "bg-blush/20 text-blush border border-blush/30"
                            : warning
                              ? "bg-blush/10 text-blush/80"
                              : "text-cream/50"
                      }`}
                    >
                      {validityLabel}
                    </span>
                  </div>
                  <div className="col-span-2 md:col-span-1 text-right flex flex-col gap-1 items-end">
                    <button
                      onClick={() => handleAddToShoppingList(item)}
                      className="md:opacity-0 md:group-hover:opacity-100 text-cream/50 hover:text-blush transition text-xs"
                      title="Adicionar à lista de compras"
                    >
                      + lista
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="md:opacity-0 md:group-hover:opacity-100 text-cream/50 hover:text-red-400 transition text-xs"
                      aria-label="Remover"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-cream/50">Nenhum item nesta categoria.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
