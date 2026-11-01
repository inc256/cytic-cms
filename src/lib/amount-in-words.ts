const SMALL_NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const GROUPS = ["", "thousand", "million", "billion", "trillion", "quadrillion"];

function underOneThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) parts.push(`${SMALL_NUMBERS[hundreds] ?? ""} hundred`);
  if (remainder >= 20) {
    const unit = remainder % 10;
    parts.push(
      `${TENS[Math.floor(remainder / 10)] ?? ""}${unit ? `-${SMALL_NUMBERS[unit] ?? ""}` : ""}`,
    );
  } else if (remainder > 0) {
    parts.push(SMALL_NUMBERS[remainder] ?? "");
  }
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative whole number.");
  }
  if (amount === 0) return "Zero Ugandan shillings only";

  let remainder = amount;
  let groupIndex = 0;
  const parts: string[] = [];
  while (remainder > 0) {
    const group = remainder % 1000;
    if (group) {
      const words = underOneThousand(group);
      parts.unshift([words, GROUPS[groupIndex] ?? ""].filter(Boolean).join(" "));
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex += 1;
  }
  const words = parts.join(" ");
  const currency = amount === 1 ? "Ugandan shilling" : "Ugandan shillings";
  return `${(words[0] ?? "").toUpperCase()}${words.slice(1)} ${currency} only`;
}
