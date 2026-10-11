"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema } from "@/lib/validation/auth";
import { isPublicDemo } from "@/lib/demo";

export type CreateUserState = { error?: string; success?: string };

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  // Checked again here, not just on the page: a server action is a public
  // POST endpoint, and hiding the form doesn't stop someone calling it.
  await requireAdmin();
  if (isPublicDemo()) {
    return { error: "Creating accounts is turned off on the public demo." };
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await db.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation (the email already exists).
    // Letting the database enforce uniqueness avoids a race between
    // "check if email exists" and "insert".
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "A user with that email already exists." };
    }
    throw err;
  }

  revalidatePath("/admin/users"); // refresh the user list
  return { success: `Created ${parsed.data.email}.` };
}
