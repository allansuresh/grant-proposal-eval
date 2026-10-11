import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { CreateUserForm } from "./create-user-form";

export const metadata = { title: "Users · Proposal Evaluator" };

export default async function UsersPage() {
  await requireAdmin(); // non-admins get a 404

  // `select` fetches only the columns we display, so password hashes
  // never leave the database, even by accident.
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { proposals: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Proposals</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role.toLowerCase()}</td>
                <td className="px-4 py-3">{u._count.proposals}</td>
                <td className="px-4 py-3">{u.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateUserForm />
    </div>
  );
}
