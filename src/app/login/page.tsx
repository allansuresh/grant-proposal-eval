import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Proposal Evaluator" };

export default function LoginPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-stone-600">
        Accounts are invite-only. Use a demo account to explore.
      </p>
      <LoginForm />
    </div>
  );
}
