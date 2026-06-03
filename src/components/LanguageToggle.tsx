import { useT } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="inline-flex items-center rounded-lg border border-surface-border bg-surface/60 backdrop-blur-sm p-0.5 text-xs">
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
          lang === "en" ? "bg-[#7C6AF7] text-white" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("ru")}
        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
          lang === "ru" ? "bg-[#7C6AF7] text-white" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        RU
      </button>
    </div>
  );
}
