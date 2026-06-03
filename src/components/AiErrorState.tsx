import { RefreshCw } from "lucide-react";
import { AI_BUSY_MESSAGE } from "@/lib/ai-error";

interface AiErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export function AiErrorState({ onRetry, message = AI_BUSY_MESSAGE }: AiErrorStateProps) {
  return (
    <main className="min-h-screen w-full bg-background flex items-center justify-center px-6">
      <div className="max-w-md rounded-xl border border-surface-border bg-surface p-6 text-center shadow-[0_12px_40px_-18px_rgba(0,0,0,0.7)]">
        <p className="text-base font-medium leading-relaxed text-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/90"
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      </div>
    </main>
  );
}