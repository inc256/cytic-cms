import { describe, expect, it } from "vitest";

import { amountInWords } from "@/lib/amount-in-words";

describe("amountInWords", () => {
  it("writes whole Ugandan shilling amounts in words", () => {
    expect(amountInWords(0)).toBe("Zero Ugandan shillings only");
    expect(amountInWords(1)).toBe("One Ugandan shilling only");
    expect(amountInWords(245)).toBe("Two hundred forty-five Ugandan shillings only");
    expect(amountInWords(1200500)).toBe(
      "One million two hundred thousand five hundred Ugandan shillings only",
    );
  });

  it("rejects fractional, unsafe, and negative amounts", () => {
    expect(() => amountInWords(-1)).toThrow();
    expect(() => amountInWords(1.5)).toThrow();
    expect(() => amountInWords(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => amountInWords(Number.NaN)).toThrow();
    expect(() => amountInWords(Number.POSITIVE_INFINITY)).toThrow();
  });
});
