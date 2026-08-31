import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/perfil")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Meu perfil — receitahub" },
      {
        name: "description",
        content: "Edite seu perfil e ajuste suas configurações no receitahub.",
      },
    ],
  }),
});

function ProfilePage() {
  const { session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  // Stats
  const [pantryCount, setPantryCount] = useState(0);
  const [recipesCount, setRecipesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/login" });
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      const [{ data: profile }, { count: pCount }, { count: rCount }, { count: fCount }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", session.user.id)
            .maybeSingle(),
          supabase
            .from("pantry_items")
            .select("*", { count: "exact", head: true })
            .eq("user_id", session.user.id),
          supabase
            .from("user_recipes")
            .select("*", { count: "exact", head: true })
            .eq("user_id", session.user.id),
          supabase
            .from("user_recipes")
            .select("*", { count: "exact", head: true })
            .eq("user_id", session.user.id)
            .eq("is_favorite", true),
        ]);
      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      }
      setPantryCount(pCount ?? 0);
      setRecipesCount(rCount ?? 0);
      setFavoritesCount(fCount ?? 0);
      setLoading(false);
    })();
  }, [session]);

  if (authLoading || !session) {
    return (
      <div className="min-h-screen bg-charcoal text-cream flex items-center justify-center">
        <div className="text-cream/50">carregando...</div>
      </div>
    );
  }

  const initial = (displayName || session.user.email || "?").charAt(0).toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Nome não pode ficar vazio");
      return;
    }
    if (trimmed.length > 80) {
      toast.error("Nome muito longo (máx 80 caracteres)");
      return;
    }
    if (avatarUrl && avatarUrl.length > 500) {
      toast.error("URL do avatar muito longa");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: session.user.id,
          display_name: trimmed,
          avatar_url: avatarUrl.trim() || null,
        },
        { onConflict: "id" },
      );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
      console.error(error);
    } else {
      toast.success("Perfil atualizado!");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const handleDeleteAccount = async () => {
    setConfirmWipe(false);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("pantry_items").delete().eq("user_id", session.user.id),
      supabase.from("user_recipes").delete().eq("user_id", session.user.id),
    ]);
    if (e1 || e2) {
      toast.error("Erro ao apagar dados");
    } else {
      toast.success("Todos os seus dados foram apagados");
      setPantryCount(0);
      setRecipesCount(0);
      setFavoritesCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap"
      />

      <section className="max-w-4xl mx-auto px-6 lg:px-10 pt-20 pb-12">
        <div className="text-xs uppercase tracking-widest text-blush mb-3">sua conta</div>
        <h1 className="text-5xl md:text-6xl text-cream leading-tight">
          meu <em className="text-blush font-display italic">perfil</em>
        </h1>
        <p className="mt-4 text-cream/70 max-w-xl">
          Personalize sua conta, gerencie suas configurações e veja um resumo da sua jornada
          culinária.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 lg:px-10 pb-24 space-y-8">
        {loading ? (
          <div className="text-center py-16 text-cream/50">carregando perfil...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-charcoal-light rounded-2xl p-5 border border-border">
                <div className="text-xs uppercase tracking-wider text-cream/50">Despensa</div>
                <div className="font-display text-3xl text-cream mt-2">{pantryCount}</div>
              </div>
              <div className="bg-charcoal-light rounded-2xl p-5 border border-border">
                <div className="text-xs uppercase tracking-wider text-cream/50">Receitas</div>
                <div className="font-display text-3xl text-cream mt-2">{recipesCount}</div>
              </div>
              <div className="bg-blush/10 rounded-2xl p-5 border border-blush/30">
                <div className="text-xs uppercase tracking-wider text-blush">Favoritas</div>
                <div className="font-display text-3xl text-blush mt-2">{favoritesCount}</div>
              </div>
            </div>

            {/* Profile form */}
            <form
              onSubmit={handleSave}
              className="bg-charcoal-light border border-border rounded-3xl p-8"
            >
              <h2 className="font-display text-2xl text-cream mb-6">Informações pessoais</h2>

              <div className="flex items-center gap-6 mb-8">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-20 w-20 rounded-full object-cover border-2 border-blush/40"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-blush/20 border-2 border-blush/40 flex items-center justify-center font-display text-3xl text-blush">
                    {initial}
                  </div>
                )}
                <div>
                  <div className="text-cream font-medium">{displayName || "Sem nome"}</div>
                  <div className="text-cream/50 text-sm">{session.user.email}</div>
                </div>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">
                    Nome de exibição
                  </span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={80}
                    placeholder="Como devemos te chamar?"
                    className="w-full bg-charcoal border border-border rounded-xl px-4 py-3 text-cream placeholder:text-cream/40 focus:outline-none focus:border-blush/50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">
                    URL do avatar (opcional)
                  </span>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    maxLength={500}
                    placeholder="https://..."
                    className="w-full bg-charcoal border border-border rounded-xl px-4 py-3 text-cream placeholder:text-cream/40 focus:outline-none focus:border-blush/50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">
                    Email
                  </span>
                  <input
                    value={session.user.email ?? ""}
                    disabled
                    className="w-full bg-charcoal/50 border border-border rounded-xl px-4 py-3 text-cream/50 cursor-not-allowed"
                  />
                  <span className="text-xs text-cream/40 mt-1 block">
                    O email não pode ser alterado.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-8 px-6 py-3 rounded-full bg-blush text-charcoal text-sm font-medium hover:bg-blush-deep transition disabled:opacity-50"
              >
                {saving ? "salvando..." : "salvar alterações"}
              </button>
            </form>

            {/* Quick links */}
            <div className="bg-charcoal-light border border-border rounded-3xl p-8">
              <h2 className="font-display text-2xl text-cream mb-6">Atalhos</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <Link
                  to="/minha-despensa"
                  className="border border-border rounded-2xl p-4 hover:border-blush/40 hover:bg-charcoal/50 transition"
                >
                  <div className="text-xl mb-1">🥫</div>
                  <div className="text-cream text-sm">Minha despensa</div>
                  <div className="text-cream/50 text-xs">Gerenciar ingredientes</div>
                </Link>
                <Link
                  to="/minhas-receitas"
                  className="border border-border rounded-2xl p-4 hover:border-blush/40 hover:bg-charcoal/50 transition"
                >
                  <div className="text-xl mb-1">📖</div>
                  <div className="text-cream text-sm">Minhas receitas</div>
                  <div className="text-cream/50 text-xs">Salvas e favoritas</div>
                </Link>
                <Link
                  to="/receitas"
                  className="border border-border rounded-2xl p-4 hover:border-blush/40 hover:bg-charcoal/50 transition"
                >
                  <div className="text-xl mb-1">✨</div>
                  <div className="text-cream text-sm">Descobrir</div>
                  <div className="text-cream/50 text-xs">Novas receitas com IA</div>
                </Link>
              </div>
            </div>

            {/* Settings / danger */}
            <div className="bg-charcoal-light border border-border rounded-3xl p-8">
              <h2 className="font-display text-2xl text-cream mb-6">Configurações</h2>

              <div className="divide-y divide-border">
                <div className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-cream text-sm">Sair da conta</div>
                    <div className="text-cream/50 text-xs">
                      Encerre sua sessão neste dispositivo.
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-full border border-border text-cream/80 hover:text-cream hover:border-cream/40 transition text-sm"
                  >
                    sair
                  </button>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-blush text-sm">Apagar todos os dados</div>
                    <div className="text-cream/50 text-xs">
                      Remove sua despensa e receitas. Não pode ser desfeito.
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmWipe(true)}
                    className="px-4 py-2 rounded-full border border-blush/40 text-blush hover:bg-blush/10 transition text-sm"
                  >
                    apagar dados
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent className="max-w-md border-border bg-charcoal text-cream sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display italic text-2xl font-normal text-blush">
              apagar todos os seus dados?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 leading-relaxed">
              Sua despensa e todas as suas receitas salvas serão removidas. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream">
              cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteAccount();
              }}
              className="rounded-full bg-red-500/90 px-6 py-2.5 text-sm text-cream transition hover:bg-red-500"
            >
              apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
