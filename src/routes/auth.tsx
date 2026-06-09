import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setAppleLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apple sign-in failed");
    } finally {
      setAppleLoading(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 pb-8 pt-24 animate-fade-in sm:px-6 sm:py-10">
      <div className="absolute right-3 top-4 flex items-center gap-1.5 sm:right-5 sm:top-5 sm:gap-2">
        <ThemeToggle />
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
          disabled={googleLoading || appleLoading}
          className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4 py-3.5 text-sm font-semibold text-foreground hover:bg-surface/70 disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? t("pleaseWait") : t("continueWithGoogle")}
        </button>
        <button
          type="button"
          onClick={handleApple}
          disabled={googleLoading || appleLoading}
          className="mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4 py-3.5 text-sm font-semibold text-foreground hover:bg-surface/70 disabled:opacity-50"
        >
          <AppleIcon />
          {appleLoading ? t("pleaseWait") : t("continueWithApple")}
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
            className="rounded-xl border border-surface-border bg-surface px-4 py-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-[#7C6AF7] sm:text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
            className="rounded-xl border border-surface-border bg-surface px-4 py-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-[#7C6AF7] sm:text-sm"
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

function AppleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="fill-current"
    >
      <path d="M17.05 12.56c-.03-2.68 2.19-3.98 2.29-4.04-1.25-1.82-3.18-2.07-3.86-2.1-1.62-.17-3.2.97-4.02.97-.84 0-2.1-.95-3.46-.92-1.75.03-3.39 1.04-4.29 2.62-1.86 3.22-.47 7.95 1.31 10.55.89 1.27 1.93 2.69 3.28 2.64 1.32-.05 1.81-.85 3.41-.85 1.58 0 2.04.85 3.42.82 1.42-.02 2.31-1.27 3.17-2.55 1.03-1.46 1.44-2.9 1.45-2.98-.03-.01-2.67-1.02-2.7-4.66ZM14.42 4.7c.72-.9 1.22-2.12 1.08-3.36-1.05.05-2.36.73-3.11 1.6-.67.77-1.27 2.04-1.11 3.23 1.18.09 2.39-.59 3.14-1.47Z" />
    </svg>
  );
}
