import { requireUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Proposals</h1>
      <div className="card">
        <p>
          Signed in as <strong>{user.email}</strong> with role{" "}
          <strong>{user.role.toLowerCase()}</strong>.
        </p>
        <p className="mt-2 text-sm text-stone-600">
          {user.role === "ADMIN"
            ? "Admins can see every proposal and manage users."
            : "Evaluators can see only the proposals they uploaded."}
        </p>
        <p className="mt-4 text-sm text-stone-500">Proposal upload arrives in Phase 2.</p>
      </div>
    </div>
  );
}
