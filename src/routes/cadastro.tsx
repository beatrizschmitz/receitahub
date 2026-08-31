import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/cadastro")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Criar conta — receitahub" },
      { name: "description", content: "Crie sua conta no receitahub e comece a cozinhar com o que você já tem." },
    ],
  }),
});

function SignupPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate({ to: "/minha-despensa" });
    }
  }, [authLoading, session, navigate]);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/minha-despensa",
        data: { display_name: name },
      },
    });

    setLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        setError("Este e-mail já está cadastrado. Tente entrar.");
      } else {
        setError(error.message);
      }
      return;
    }

    setSuccess(true);
  };

  const handleGoogle = async () => {
    setError("");
    // OAuth direto no Supabase. Antes isso passava pelo wrapper do Lovable, que
    // montava um /~oauth/initiate — rota da hospedagem do Lovable, que não
    // existe mais. Em caso de sucesso o navegador é redirecionado e nada abaixo
    // desta chamada roda; a sessão é lida da URL de volta pelo próprio
    // supabase-js (detectSessionInUrl vem ligado por padrão).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/minha-despensa` },
    });
    if (error) {
      setError("Erro ao entrar com Google.");
    }
  };

  return (
    <div className="min-h-screen bg-charcoal text-cream flex items-center justify-center px-6 py-12">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap"
      />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blush/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        <Link to="/" className="font-display italic text-blush text-2xl font-mono block text-center mb-10">
          receitahub
        </Link>

        <div className="bg-charcoal-light border border-border rounded-3xl p-8">
          {success ? (
            <div className="text-center py-6">
              <Mail className="mx-auto mb-4 h-9 w-9 text-blush" strokeWidth={1} />
              <h2 className="font-display text-2xl text-cream mb-3">Verifique seu e-mail</h2>
              <p className="text-cream/70 text-sm mb-6">
                Enviamos um link de confirmação para <strong className="text-blush">{email}</strong>.
                Clique nele para ativar sua conta.
              </p>
              <Link to="/login" className="text-blush hover:text-blush-deep text-sm">
                Voltar para login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-3xl text-cream mb-2">
                Criar <em className="font-display italic text-blush">conta</em>
              </h1>
              <p className="text-cream/60 text-sm mb-8">Comece a cozinhar com o que você já tem.</p>

              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 bg-cream text-charcoal rounded-full py-3 font-medium hover:bg-cream/90 transition mb-6"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Cadastrar com Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-cream/40">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="text-sm text-cream/60 mb-2 block">Nome</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-charcoal border border-border rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-blush/50 transition"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-2 block">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-charcoal border border-border rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-blush/50 transition"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-2 block">Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-charcoal border border-border rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-blush/50 transition"
                  />
                  <p className="text-xs text-cream/40 mt-1.5">Mínimo 6 caracteres</p>
                </div>

                {error && (
                  <div className="text-sm text-blush bg-blush/10 border border-blush/30 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blush text-charcoal rounded-full py-3 font-medium hover:bg-blush-deep transition disabled:opacity-50"
                >
                  {loading ? "criando..." : "criar conta"}
                </button>
              </form>

              <p className="text-center text-sm text-cream/60 mt-6">
                Já tem conta?{" "}
                <Link to="/login" className="text-blush hover:text-blush-deep font-medium">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
