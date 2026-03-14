import { describe, expect, it } from "vitest";
import { isHighRiskAction } from "../src/risk-actions";
import { shouldRequirePrimaryPassword } from "../src/unlock-policy";

describe("isHighRiskAction", () => {
  it("marks export as high risk", () => {
    expect(isHighRiskAction("vault_export")).toBe(true);
  });
});

describe("shouldRequirePrimaryPassword", () => {
  it("requires primary password for revoke-device", () => {
    expect(shouldRequirePrimaryPassword("revoke_device")).toBe(true);
  });
});
