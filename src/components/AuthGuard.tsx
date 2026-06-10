import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { FullScreenLoader } from "@/components/FullScreenLoader";

export function AuthGuard({
  children,
  loadingTitle = "Loading...",
  loadingSubtitle,
}: {
  children: ReactNode;
  loadingTitle?: string;
  loadingSubtitle?: string;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <FullScreenLoader title={loadingTitle} subtitle={loadingSubtitle} />;
  }
  return <>{children}</>;
}
