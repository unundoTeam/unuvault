import { describe, expect, it } from "vitest";
import { phase1Tables } from "../src/db-types";

describe("phase1Tables", () => {
  it("includes the five core phase1 tables", () => {
    expect(phase1Tables).toEqual([
      "users_profile",
      "vault_items",
      "device_sessions",
      "import_jobs",
      "activity_events",
    ]);
  });
});
