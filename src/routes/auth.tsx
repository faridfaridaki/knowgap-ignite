import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — KnowGap" },
      { name: "description", content: "Sign in or create a KnowGap account." },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (err) throw err;
        if (data.session) {
          navigate({ to: "/" });
        } else {
          setInfo("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-[420px]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to save your learning sessions."
            : "Sign up to save and revisit your learning sessions."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-[#7C6AF7]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
            className="rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-[#7C6AF7]"
          />
          {error && (
            <p className="text-sm text-[#F87171]">{error}</p>
          )}
          {info && (
            <p className="text-sm text-[#4ADE80]">{info}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-transform disabled:opacity-40 enabled:hover:scale-[1.02] shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
            }}
          >
            {submitting
              ? "Please wait…"
              : mode === "signin"
                ? "Sign In"
                : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="text-[#7C6AF7] hover:underline underline-offset-4"
          >
            {mode === "signin" ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </div>
    </main>
  );
}
