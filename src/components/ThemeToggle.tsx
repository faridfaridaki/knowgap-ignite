import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDay = theme === "day";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDay ? "Switch to night mode" : "Switch to day mode"}
      title={isDay ? "Night mode" : "Day mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface/60 text-foreground backdrop-blur-sm transition-colors hover:bg-surface"
    >
      {isDay ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
