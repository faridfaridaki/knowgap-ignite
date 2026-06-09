import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Home } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/lib/i18n";

export function HomeButton() {
  const navigate = useNavigate();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const goHome = () => {
    // Progress is auto-persisted via sessionStorage (learning-state) and Supabase
    // on final-analysis save; nothing extra needed here.
    setOpen(false);
    navigate({ to: "/" });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-4 z-40 inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-border bg-surface/60 px-2.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-surface sm:left-5 sm:top-5 sm:px-3"
        aria-label={t("home")}
      >
        <Home size={14} />
        <span className="hidden sm:inline">{t("home")}</span>
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("homeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("homeConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={goHome}>{t("yesGoHome")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
