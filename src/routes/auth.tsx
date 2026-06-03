import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

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
  const { t } = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(
          result.error instanceof Error ? result.error.message : String(result.error),
        );
        return;
      }
      if (result.redirected) return; // browser will navigate
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

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
          setInfo(t("checkEmail"));
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
    <main className="min-h-screen w-full bg-background px-6 py-10 flex items-center justify-center animate-fade-in">
      <div className="absolute top-5 right-5">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-[420px]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> {t("back")}
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          {mode === "signin" ? t("welcomeBackTitle") : t("createAccount")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin" ? t("signInSub") : t("signUpSub")}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="mt-8 w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface/70 disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? t("pleaseWait") : t("continueWithGoogle")}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-surface-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("orDivider")}
          </span>
          <div className="h-px flex-1 bg-surface-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            required
            className="rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-[#7C6AF7]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
            className="rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-[#7C6AF7]"
          />
          {error && <p className="text-sm text-[#F87171]">{error}</p>}
          {info && <p className="text-sm text-[#4ADE80]">{info}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-transform disabled:opacity-40 enabled:hover:scale-[1.02] shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)]"
            style={{
              backgroundImage: "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
            }}
          >
            {submitting ? t("pleaseWait") : mode === "signin" ? t("signIn") : t("signUp")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? t("newHere") : t("haveAccount")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="text-[#7C6AF7] hover:underline underline-offset-4"
          >
            {mode === "signin" ? t("createAccountLink") : t("signInInstead")}
          </button>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
