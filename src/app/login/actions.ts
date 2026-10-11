"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

// Shared by the form and the demo buttons.
async function attemptSignIn(email: string, password: string): Promise<LoginState> {
  try {
    // On success, signIn throws a special redirect "error" that Next.js
    // handles itself, so we only reach the catch block on real failures.
    await signIn("credentials", { email, password, redirectTo: "/" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      // Deliberately vague: don't reveal whether the email exists.
      return { error: "Invalid email or password." };
    }
    throw err; // includes the success redirect; let Next.js handle it
  }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  return attemptSignIn(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
}

// The demo password is read on the server, so it never ships to the browser.
export async function demoLoginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const role = formData.get("role");
  const password = process.env.DEMO_PASSWORD;
  if (!password) return { error: "Demo accounts are not configured." };
  const email =
    role === "ADMIN" ? "demo-admin@example.com" : "demo-evaluator@example.com";
  return attemptSignIn(email, password);
}
