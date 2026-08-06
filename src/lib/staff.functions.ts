import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (error) throw new Error("Could not verify permissions");
  if (!data || data.length === 0) throw new Error("Only administrators can do this");
}

export const listWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["staff", "admin"]);
    if (rolesError) throw new Error(rolesError.message);

    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { workers: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email, specialty")
      .in("id", ids);

    const workers = (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      specialty: p.specialty ?? "",
      role: (roles ?? []).find((r) => r.user_id === p.id)?.role ?? "staff",
    }));

    workers.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return { workers };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((roles ?? []).some((r) => r.role === "admin")) {
      throw new Error("Administrator accounts cannot be deleted here");
    }

    await supabaseAdmin.from("staff_members").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
