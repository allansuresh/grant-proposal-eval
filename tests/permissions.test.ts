import { describe, expect, it } from "vitest";
import {
  canAccessProposal,
  isAdmin,
  proposalScope,
  type SessionUser,
} from "@/lib/auth/permissions";

const admin: SessionUser = { id: "a1", email: "admin@example.com", role: "ADMIN" };
const alice: SessionUser = { id: "e1", email: "alice@example.com", role: "EVALUATOR" };
const bob: SessionUser = { id: "e2", email: "bob@example.com", role: "EVALUATOR" };

describe("permissions", () => {
  it("identifies admins", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(alice)).toBe(false);
  });

  it("scopes evaluator queries to their own proposals", () => {
    expect(proposalScope(alice)).toEqual({ ownerId: "e1" });
  });

  it("gives admins an unrestricted scope", () => {
    expect(proposalScope(admin)).toEqual({});
  });

  it("lets owners and admins access a proposal", () => {
    const alicesProposal = { ownerId: "e1" };
    expect(canAccessProposal(alice, alicesProposal)).toBe(true);
    expect(canAccessProposal(admin, alicesProposal)).toBe(true);
  });

  it("blocks evaluators from other users' proposals", () => {
    expect(canAccessProposal(bob, { ownerId: "e1" })).toBe(false);
  });
});
