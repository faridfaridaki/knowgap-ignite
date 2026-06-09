import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";

export function UserMenu() {
  const { user, loading } = useAuth();
  const { t } = useT();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-border bg-surface/60 px-2.5 text-xs font-medium text-foreground backdrop-blur-sm hover:bg-surface sm:px-3"
      >
        {t("signIn")}
      </Link>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-border bg-surface/60 px-1.5 backdrop-blur-sm sm:gap-2 sm:px-2">
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{
          backgroundImage: "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
        }}
      >
        {initial}
      </span>
      <span className="hidden max-w-[140px] truncate text-xs text-foreground sm:inline">
        {user.email}
      </span>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        title={t("signOut")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
