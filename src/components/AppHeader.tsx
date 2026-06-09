import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { HomeButton } from "@/components/HomeButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
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
      <div className="absolute right-3 top-4 z-10 flex max-w-[calc(100vw-4.75rem)] flex-wrap items-center justify-end gap-1.5 sm:right-5 sm:top-5 sm:max-w-none sm:gap-2">
        <ThemeToggle />
        <LanguageToggle />
        {user && (
          <Link
            to="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-border bg-surface/60 px-2.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-surface sm:px-3"
            aria-label={t("dashboard")}
          >
            <LayoutDashboard size={14} />
            <span className="hidden sm:inline">{t("dashboard")}</span>
          </Link>
        )}
        <UserMenu />
      </div>
    </>
  );
}
