import { describe, it, expect } from "vitest";
import { ratingFrom } from "../shared/rating.ts";

describe("mapeamento de rating FSRS (spec 06.1)", () => {
  it("acerto rápido sem dica → Easy (4)", () => expect(ratingFrom(0, 0, 5000, false)).toBe(4));
  it("acerto com ≤1 dica → Good (3)", () => expect(ratingFrom(1, 0, 40000, false)).toBe(3));
  it("acerto após 1 erro → Good (3)", () => expect(ratingFrom(0, 1, 40000, false)).toBe(3));
  it("acerto após 2-3 dicas → Hard (2)", () => expect(ratingFrom(2, 1, 40000, false)).toBe(2));
  it("desistiu → Again (1)", () => expect(ratingFrom(3, 3, 90000, true)).toBe(1));
  it("acerto sem dica mas lento → Good (3), não Easy", () => expect(ratingFrom(0, 0, 60000, false)).toBe(3));
});
