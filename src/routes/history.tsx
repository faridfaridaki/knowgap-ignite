import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy route — redirect to the new dashboard.
export const Route = createFileRoute("/history")({
  component: () => <Navigate to="/dashboard" replace />,
});
