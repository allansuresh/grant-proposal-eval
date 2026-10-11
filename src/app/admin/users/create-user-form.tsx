"use client";

import { useActionState } from "react";
import { createUserAction, type CreateUserState } from "./actions";

const initial: CreateUserState = {};

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initial);

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="font-semibold">Invite a user</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required className="input" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Temporary password</span>
          <input name="password" type="password" required minLength={10} className="input" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Role</span>
          <select name="role" defaultValue="EVALUATOR" className="input">
            <option value="EVALUATOR">Evaluator</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creating…" : "Create user"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
