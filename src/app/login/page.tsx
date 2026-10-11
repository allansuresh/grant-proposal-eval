import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Proposal Evaluator" };

type Props = { searchParams: Promise<{ expired?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { expired } = await searchParams;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-stone-600">
        Accounts are invite-only. Use a demo account to explore.
      </p>
      {expired && (
        <p role="status" className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Your session is no longer valid (the account may have been removed or changed).
          Please sign in again.
        </p>
      )}
      <LoginForm />
    </div>
  );
}
