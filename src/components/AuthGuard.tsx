import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { FullScreenLoader } from "@/components/FullScreenLoader";

export function AuthGuard({
  children,
  loadingTitle = "Loading...",
  loadingSubtitle,
  preserveTopicForAuth = false,
}: {
  children: ReactNode;
  loadingTitle?: string;
  loadingSubtitle?: string;
  preserveTopicForAuth?: boolean;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      if (preserveTopicForAuth) {
        try {
          const activeTopic = sessionStorage.getItem("knowgap:topic")?.trim();
          const pendingTopic = sessionStorage.getItem("knowgap:pendingTopic")?.trim();
          if (activeTopic && !pendingTopic) {
            sessionStorage.setItem("knowgap:pendingTopic", activeTopic);
          }
        } catch {}
      }
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate, preserveTopicForAuth]);

  if (loading || !user) {
    return <FullScreenLoader title={loadingTitle} subtitle={loadingSubtitle} />;
  }
  return <>{children}</>;
}
