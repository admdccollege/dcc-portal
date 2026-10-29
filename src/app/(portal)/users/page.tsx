import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { param } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { FilterBar } from "@/components/shared/filter-bar";
import { UserRowActions } from "@/components/user-row-actions";
import { PERMISSIONS, ROLES, ROLE_KEYS, ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { formatDate, searchFilter } from "@/lib/utils";

export const metadata: Metadata = { title: "Users & permissions" };

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const session = await requirePermission("users.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const roleFilter = ROLE_KEYS.find((r) => r === param(sp.role));

  let q = supabase.from("profiles").select("id, full_name, email, is_active, last_seen_at, created_at, user_roles!user_roles_user_id_fkey(roles(key))").order("full_name").limit(500);
  const search = searchFilter(["full_name", "email"], param(sp.q));
  if (search) q = q.or(search);
  const [{ data: profiles }, { data: staffLinks }, { data: studentLinks }] = await Promise.all([
    q,
    supabase.from("staff").select("id, profile_id").not("profile_id", "is", null),
    supabase.from("students").select("id, profile_id").not("profile_id", "is", null),
  ]);
  const staffBy = new Map((staffLinks ?? []).map((s) => [s.profile_id, s.id]));
  const studentBy = new Map((studentLinks ?? []).map((s) => [s.profile_id, s.id]));
  const rows = (profiles ?? []).map((p) => ({ ...p, roles: p.user_roles.map((r) => r.roles?.key).filter((x): x is string => !!x) }))
    .filter((p) => !roleFilter || p.roles.includes(roleFilter));
  const modules = [...new Set(Object.values(PERMISSIONS).map((p) => p.module))];
  const manage = can(session, "users.manage");
  const isSuper = session.roles.includes("super_admin");

  return (
    <div className="space-y-5">
      <PageHeader title="Users & Permissions" description="Login accounts, role assignment and the role permission matrix. Create logins from a staff or student record." />
      <Tabs defaultValue="users">
        <TabsList><TabsTrigger value="users">User accounts</TabsTrigger><TabsTrigger value="matrix">Permission matrix</TabsTrigger></TabsList>
        <TabsContent value="users" className="space-y-4">
          <FilterBar searchPlaceholder="Name or email…" filters={[{ name: "role", label: "Roles", options: ROLE_KEYS.map((r) => ({ value: r, label: ROLES[r].name })) }]} />
          <Card>
            {!rows.length ? <div className="p-6"><EmptyState title="No users found" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead><TableHead>Linked record</TableHead><TableHead>Last sign-in</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{u.roles.length ? u.roles.map((r) => <Badge key={r} variant={r === "super_admin" ? "destructive" : "secondary"}>{ROLES[r as keyof typeof ROLES]?.name ?? r}</Badge>) : <span className="text-xs text-muted-foreground">No role</span>}</div></TableCell>
                      <TableCell className="text-sm">
                        {staffBy.get(u.id) ? <Link className="text-primary hover:underline" href={`/staff/${staffBy.get(u.id)}`}>Staff record</Link>
                          : studentBy.get(u.id) ? <Link className="text-primary hover:underline" href={`/students/${studentBy.get(u.id)}`}>Student record</Link> : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(u.last_seen_at, true)}</TableCell>
                      <TableCell>{u.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Deactivated</Badge>}</TableCell>
                      <TableCell className="text-right">{manage && <UserRowActions userId={u.id} name={u.full_name || u.email || "user"} roles={u.roles} active={u.is_active} isSelf={u.id === session.userId} canGrantSuper={isSuper} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="matrix">
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">
              Permissions are enforced in the database (row-level security and secured functions) and in the application. The matrix is defined in source control
              (<code>src/lib/auth/permissions.ts</code>) and applied by migration, so every environment stays consistent and changes are reviewed. Ownership rules also apply:
              teachers see only their assigned classes; students see only their own records.
            </CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-2 text-left">Permission</th>
                    {ROLE_KEYS.map((r) => <th key={r} className="p-2 text-center">{ROLES[r].name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <Fragment key={m}>
                      <tr className="bg-muted/40"><td colSpan={ROLE_KEYS.length + 1} className="p-2 font-semibold">{m}</td></tr>
                      {(Object.entries(PERMISSIONS) as [Permission, { module: string; description: string }][]).filter(([, p]) => p.module === m).map(([k, p]) => (
                        <tr key={k} className="border-t">
                          <td className="p-2"><span className="font-mono">{k}</span><span className="block text-muted-foreground">{p.description}</span></td>
                          {ROLE_KEYS.map((r) => <td key={r} className="p-2 text-center">{ROLE_PERMISSIONS[r].includes(k) ? <Check className="mx-auto size-4 text-success" aria-label="Granted" /> : <span className="text-muted-foreground" aria-label="Not granted">·</span>}</td>)}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
