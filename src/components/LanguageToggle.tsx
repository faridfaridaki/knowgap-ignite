import { useT } from "@/lib/i18n";

const LANG_OPTIONS = [
  { code: "en" as const, label: "EN" },
  { code: "ru" as const, label: "RU" },
  { code: "kk" as const, label: "KZ" },
];

export function LanguageToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="inline-flex items-center rounded-lg border border-surface-border bg-surface/60 backdrop-blur-sm p-0.5 text-xs">
      {LANG_OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
            lang === option.code
              ? "bg-[#7C6AF7] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
