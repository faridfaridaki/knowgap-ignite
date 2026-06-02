import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function UserMenu() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface/60 backdrop-blur-sm px-2 py-1.5">
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
        }}
      >
        {initial}
      </span>
      <span className="max-w-[140px] truncate text-xs text-foreground">
        {user.email}
      </span>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        title="Sign out"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
