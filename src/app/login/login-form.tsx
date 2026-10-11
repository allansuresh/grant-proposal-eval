"use client";

// A Client Component, because it uses React state (useActionState) to show
// errors and a pending state. The actual work happens in the server actions.
import { useActionState } from "react";
import { demoLoginAction, loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const [demoState, demoAction, demoPending] = useActionState(demoLoginAction, initial);
  const error = state.error ?? demoState.error;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="border-t border-stone-200 pt-4">
        <p className="mb-3 text-sm text-stone-600">Or try a demo account:</p>
        <form action={demoAction} className="grid grid-cols-2 gap-3">
          <button name="role" value="EVALUATOR" disabled={demoPending} className="btn-secondary">
            Demo evaluator
          </button>
          <button name="role" value="ADMIN" disabled={demoPending} className="btn-secondary">
            Demo admin
          </button>
        </form>
      </div>
    </div>
  );
}
