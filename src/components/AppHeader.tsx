import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { HomeButton } from "@/components/HomeButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";

export function AppHeader() {
  const { user } = useAuth();
  const { t } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  return (
    <>
      {!isHome && <HomeButton />}
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
        <LanguageToggle />
        {user && (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
          >
            <LayoutDashboard size={14} />
            <span>{t("dashboard")}</span>
          </Link>
        )}
        <UserMenu />
      </div>
    </>
  );
}
