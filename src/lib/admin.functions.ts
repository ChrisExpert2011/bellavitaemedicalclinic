import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).optional().default(""),
        specialty: z.string().trim().min(2).max(120),
        addToTeam: z.boolean().optional().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");

    if (rolesError) throw new Error("Could not verify permissions");
    if (!roles || roles.length === 0) throw new Error("Only administrators can register workers");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone, role: "staff" },
    });
    if (error) throw new Error(error.message);

    if (created.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ specialty: data.specialty, phone: data.phone, full_name: data.fullName })
        .eq("id", created.user.id);
    }

    if (data.addToTeam) {
      await supabaseAdmin.from("staff_members").insert({
        full_name: data.fullName,
        specialty: data.specialty,
        phones: data.phone || null,
      });
    }

    return { ok: true, email: data.email };
  });