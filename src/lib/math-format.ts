const SUPERSCRIPT_CHARS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
};

const SUBSCRIPT_CHARS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  b: "ᵦ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

export const MATH_FORMAT_RULE =
  "For math notation, use proper Unicode superscripts and subscripts. Write x², y³, 10⁵, 5x⁴, logᵦ x, log₂ x, and log₁₀ x. Never write caret powers like x^2 or logarithm bases with underscores like log_b/log_2.";

function toScript(value: string, map: Record<string, string>): string {
  return value
    .split("")
    .map((char) => map[char] ?? map[char.toLowerCase()] ?? char)
    .join("");
}

export function normalizeMathText(value: string): string {
  return value
    .replace(
      /\blog_\{([^}]+)\}/gi,
      (_match, base: string) => `log${toScript(base, SUBSCRIPT_CHARS)}`,
    )
    .replace(
      /\blog_([A-Za-z0-9]+)/gi,
      (_match, base: string) => `log${toScript(base, SUBSCRIPT_CHARS)}`,
    )
    .replace(/\^\{([^}]+)\}/g, (_match, power: string) => toScript(power, SUPERSCRIPT_CHARS))
    .replace(/\^([A-Za-z0-9+\-=()]+)/g, (_match, power: string) =>
      toScript(power, SUPERSCRIPT_CHARS),
    );
}
