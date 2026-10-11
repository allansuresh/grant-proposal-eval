import { z } from "zod";

// Zod schemas validate untrusted input (form data) at the server boundary
// and give us TypeScript types for free via z.infer.

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1, "Password is required").max(200),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(200, "Password is too long"),
  role: z.enum(["ADMIN", "EVALUATOR"]),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
