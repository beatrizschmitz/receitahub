import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Package, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/account.functions";
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

const DELETE_ACCOUNT_CONFIRM_WORD = "EXCLUIR";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipingData, setWipingData] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const callDeleteAccount = useServerFn(deleteAccount);

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
            .select("display_name")
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
        <div className="text-cream/50">Carregando...</div>
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
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(
      {
        id: session.user.id,
        display_name: trimmed,
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

  // Apaga despensa e receitas, mas mantém a conta/login — diferente de
  // handleDeleteAccountPermanently, que exclui a conta de verdade.
  const handleWipeData = async () => {
    setWipingData(true);
    try {
      const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
        supabase.from("pantry_items").delete().eq("user_id", session.user.id),
        supabase.from("user_recipes").delete().eq("user_id", session.user.id),
        supabase.from("calorie_log").delete().eq("user_id", session.user.id),
      ]);
      if (e1 || e2 || e3) {
        toast.error("Erro ao Apagar dados");
      } else {
        toast.success("Todos os seus dados foram apagados");
        setPantryCount(0);
        setRecipesCount(0);
        setFavoritesCount(0);
      }
    } finally {
      setWipingData(false);
      setConfirmWipe(false);
    }
  };

  // Exclusão de conta de verdade: some com o login também, não só os dados.
  // Irreversível — por isso exige digitar a palavra de confirmação antes.
  const handleDeleteAccountPermanently = async () => {
    if (deleteAccountText.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRM_WORD) return;
    setDeletingAccount(true);
    try {
      const result = await callDeleteAccount();
      if (result.success) {
        setConfirmDeleteAccount(false);
        toast.success("Sua conta foi excluída.");
        await signOut();
        navigate({ to: "/" });
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      console.error(e);
      toast.error("Não consegui excluir sua conta. Tente novamente.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap"
      />

      <section className="max-w-4xl mx-auto px-6 lg:px-10 pt-20 pb-12">
        <h1 className="text-5xl md:text-6xl text-cream leading-tight">
          Meu <em className="text-blush font-display italic">perfil</em>
        </h1>
        <p className="mt-4 text-cream/70 max-w-xl">
          Personalize sua conta, gerencie suas configurações e veja um resumo da sua jornada
          culinária.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 lg:px-10 pb-24 space-y-8">
        {loading ? (
          <div className="text-center py-16 text-cream/50">Carregando perfil...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-charcoal-light rounded-2xl p-5 border border-border">
                <div className="text-sm text-cream/50">Despensa</div>
                <div className="font-display text-3xl text-cream mt-2">{pantryCount}</div>
              </div>
              <div className="bg-charcoal-light rounded-2xl p-5 border border-border">
                <div className="text-sm text-cream/50">Receitas</div>
                <div className="font-display text-3xl text-cream mt-2">{recipesCount}</div>
              </div>
              <div className="bg-blush/10 rounded-2xl p-5 border border-blush/30">
                <div className="text-sm text-blush">Favoritas</div>
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
                <div className="h-20 w-20 rounded-full bg-blush/20 border-2 border-blush/40 flex items-center justify-center font-display text-3xl text-blush">
                  {initial}
                </div>
                <div>
                  <div className="text-cream font-medium">{displayName || "Sem nome"}</div>
                  <div className="text-cream/50 text-sm">{session.user.email}</div>
                </div>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm text-cream/50 mb-2 block">Nome de exibição</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={80}
                    placeholder="Como devemos te chamar?"
                    className="w-full bg-charcoal border border-border rounded-xl px-4 py-3 text-cream placeholder:text-cream/40 focus:outline-none focus:border-blush/50"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-cream/50 mb-2 block">Email</span>
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
                  <Package className="mb-1.5 h-5 w-5 text-blush" strokeWidth={1.5} />
                  <div className="text-cream text-sm">Minha despensa</div>
                  <div className="text-cream/50 text-xs">Gerenciar ingredientes</div>
                </Link>
                <Link
                  to="/minhas-receitas"
                  className="border border-border rounded-2xl p-4 hover:border-blush/40 hover:bg-charcoal/50 transition"
                >
                  <BookOpen className="mb-1.5 h-5 w-5 text-blush" strokeWidth={1.5} />
                  <div className="text-cream text-sm">Minhas receitas</div>
                  <div className="text-cream/50 text-xs">Salvas e favoritas</div>
                </Link>
                <Link
                  to="/receitas"
                  className="border border-border rounded-2xl p-4 hover:border-blush/40 hover:bg-charcoal/50 transition"
                >
                  <Sparkles className="mb-1.5 h-5 w-5 text-blush" strokeWidth={1.5} />
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
                    Sair
                  </button>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-blush text-sm">Apagar todos os dados</div>
                    <div className="text-cream/50 text-xs">
                      Remove sua despensa, receitas e histórico de calorias. Não pode ser desfeito.
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmWipe(true)}
                    className="px-4 py-2 rounded-full border border-blush/40 text-blush hover:bg-blush/10 transition text-sm"
                  >
                    Apagar dados
                  </button>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-red-400 text-sm">Excluir minha conta</div>
                    <div className="text-cream/50 text-xs">
                      Exclui a conta por completo — despensa, receitas, assinatura e o login.
                      Diferente de "Apagar dados", você não poderá mais entrar.
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteAccount(true)}
                    className="px-4 py-2 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 transition text-sm shrink-0"
                  >
                    Excluir conta
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
              Apagar todos os seus dados?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 leading-relaxed">
              Sua despensa, suas receitas salvas e seu histórico de calorias consumidas serão
              removidos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={wipingData}
              className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream disabled:opacity-40 disabled:pointer-events-none"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={wipingData}
              onClick={(e) => {
                e.preventDefault();
                void handleWipeData();
              }}
              className="rounded-full bg-red-500/90 px-6 py-2.5 text-sm text-cream transition hover:bg-red-500 disabled:opacity-60 disabled:pointer-events-none"
            >
              {wipingData ? "apagando..." : "Apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteAccount}
        onOpenChange={(open) => {
          setConfirmDeleteAccount(open);
          if (!open) setDeleteAccountText("");
        }}
      >
        <AlertDialogContent className="max-w-md border-border bg-charcoal text-cream sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display italic text-2xl font-normal text-red-400">
              Excluir sua conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 leading-relaxed">
              Isso exclui sua conta por completo: despensa, receitas, assinatura e o acesso ao
              receitahub. Essa ação é permanente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block mt-2">
            <span className="text-sm text-cream/50 mb-2 block">
              Digite <span className="text-red-400 font-medium">{DELETE_ACCOUNT_CONFIRM_WORD}</span>{" "}
              para confirmar
            </span>
            <input
              autoFocus
              value={deleteAccountText}
              onChange={(e) => setDeleteAccountText(e.target.value)}
              placeholder={DELETE_ACCOUNT_CONFIRM_WORD}
              className="w-full bg-charcoal-light border border-border rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 focus:outline-none focus:border-red-400/60"
            />
          </label>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-full border border-border bg-transparent px-6 py-2.5 text-sm text-cream/70 transition hover:border-cream/40 hover:bg-transparent hover:text-cream">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                deleteAccountText.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRM_WORD ||
                deletingAccount
              }
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteAccountPermanently();
              }}
              className="rounded-full bg-red-500/90 px-6 py-2.5 text-sm text-cream transition hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none"
            >
              {deletingAccount ? "excluindo..." : "Excluir conta definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
