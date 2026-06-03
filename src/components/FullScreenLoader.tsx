import { Brain } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
}

export function FullScreenLoader({ title, subtitle }: Props) {
  return (
    <main className="min-h-screen w-full bg-background flex items-center justify-center px-6 animate-fade-in">
      <div className="text-center max-w-md">
        <div className="relative mx-auto h-20 w-20">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-60 animate-pulse"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #4FC4CF)" }}
          />
          <div
            className="relative flex h-full w-full items-center justify-center rounded-full shadow-[0_8px_30px_-8px_rgba(124,106,247,0.6)]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            <Brain size={36} className="text-white animate-pulse" />
          </div>
        </div>
        <h2 className="mt-7 text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#7C6AF7] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-[#7C6AF7] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 rounded-full bg-[#7C6AF7] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </main>
  );
}
