import { apiGuard, qp } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";

export async function GET(request: Request) {
  const guard = await apiGuard(["audit.view"], 5);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("created_at, action, entity_type, entity_id, details, profiles(full_name, email)").order("created_at", { ascending: false }).limit(10000);
  const entity = qp(url, "entity");
  const day = qp(url, "date");
  if (entity && /^[a-z_]+$/.test(entity)) q = q.eq("entity_type", entity);
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) q = q.gte("created_at", `${day}T00:00:00+05:30`).lt("created_at", `${day}T23:59:59.999+05:30`);
  const { data } = await q;
  type Row = NonNullable<typeof data>[number];
  return exportResponse(url.searchParams.get("format"), data ?? [], [
    { header: "Time", value: (r: Row) => r.created_at },
    { header: "Actor", value: (r) => r.profiles?.email ?? "system" },
    { header: "Action", value: (r) => r.action },
    { header: "Entity", value: (r) => r.entity_type },
    { header: "Entity ID", value: (r) => r.entity_id },
    { header: "Details", value: (r) => JSON.stringify(r.details).slice(0, 2000) },
  ], "audit_log");
}
