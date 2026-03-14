import { describe, expect, it } from "vitest";
import { shouldOfferAutofill } from "../src/content/autofill";

describe("shouldOfferAutofill", () => {
  it("returns true when a password field is detected", () => {
    expect(shouldOfferAutofill({ hasPasswordField: true })).toBe(true);
  });
});
