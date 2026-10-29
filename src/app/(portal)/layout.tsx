import { requireSession } from "@/lib/auth/session";
import { visibleNav } from "@/lib/navigation";
import { ROLES } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: settings }, { data: notifications }] = await Promise.all([
    supabase.from("institution_settings").select("name, short_name").single(),
    supabase
      .from("notifications")
      .select("id, title, body, link, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const items = visibleNav(session.permissions);
  const roleLabel = session.roles.map((r) => ROLES[r]?.name ?? r).join(", ") || "No role assigned";
  const name = settings?.name ?? "Damdei Christian College";
  const shortName = settings?.short_name ?? "DCC";

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Sidebar items={items} shortName={shortName} name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          items={items}
          userName={session.fullName}
          roleLabel={roleLabel}
          notifications={notifications ?? []}
          shortName={shortName}
          name={name}
          profileHref={session.studentId ? "/my/profile" : "/account/password"}
        />
        <main id="main" className="flex-1 px-3 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
