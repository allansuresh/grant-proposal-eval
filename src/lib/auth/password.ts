import bcrypt from "bcryptjs";

// bcrypt is deliberately slow: each extra "cost" step doubles the work, which
// makes brute-forcing a leaked hash expensive. 12 is a common default today.
// bcryptjs is a pure-JavaScript implementation, so there's no native build step.
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
