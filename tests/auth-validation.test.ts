import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createUserSchema, credentialsSchema } from "@/lib/validation/auth";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse"); // never stored in plain text
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("salts hashes, so the same password hashes differently each time", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
  });
});

describe("credentialsSchema", () => {
  it("normalises email case and whitespace", () => {
    const r = credentialsSchema.parse({ email: "  Alice@Example.COM ", password: "x" });
    expect(r.email).toBe("alice@example.com");
  });

  it("rejects malformed emails and empty passwords", () => {
    expect(credentialsSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("rejects missing fields (e.g. FormData.get returning null)", () => {
    expect(credentialsSchema.safeParse({ email: null, password: null }).success).toBe(false);
  });
});

describe("createUserSchema", () => {
  const valid = { email: "new@example.com", password: "long-enough-pw", role: "EVALUATOR" };

  it("accepts valid input", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces a minimum password length", () => {
    const r = createUserSchema.safeParse({ ...valid, password: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown roles", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "SUPERUSER" }).success).toBe(false);
  });
});
