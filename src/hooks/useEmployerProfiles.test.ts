import { describe, it, expect } from "vitest";
import { rowToCompany, companyToRow } from "./useEmployerProfiles";

describe("rowToCompany", () => {
  it("maps snake_case columns to camelCase", () => {
    const c = rowToCompany({
      id: "c1",
      name: "Acme",
      logo_url: "https://x/logo.png",
      headquarters: "Austin, TX",
      about: "We build things",
      extra: { foo: 1 },
    });
    expect(c.id).toBe("c1");
    expect(c.name).toBe("Acme");
    expect(c.logoUrl).toBe("https://x/logo.png");
    expect(c.headquarters).toBe("Austin, TX");
    expect(c.about).toBe("We build things");
    expect(c.extra).toEqual({ foo: 1 });
  });

  it("defaults a missing name to '' and extra to {}", () => {
    const c = rowToCompany({ id: "c1" });
    expect(c.name).toBe("");
    expect(c.extra).toEqual({});
  });
});

describe("companyToRow", () => {
  it("maps camelCase to snake_case and skips undefined keys", () => {
    const row = companyToRow({ name: "Acme", logoUrl: "https://x" });
    expect(row.name).toBe("Acme");
    expect(row.logo_url).toBe("https://x");
    expect(row).not.toHaveProperty("about");
    expect(row).not.toHaveProperty("mission");
  });

  it("coerces provided optionals to null", () => {
    const row = companyToRow({ name: "Acme", tagline: undefined, about: "" });
    expect(row).not.toHaveProperty("tagline");
    expect(row.about).toBe("");
  });
});
