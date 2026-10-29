import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/misc";

export default async function Home() {
  const session = await requireSession();
  if (session.permissions.has("dashboard.view")) redirect("/dashboard");
  if (session.studentId && session.permissions.has("portal.student")) redirect("/my");
  return (
    <EmptyState
      title="No role assigned yet"
      description="Your account is active but has no role. Please contact the college office to have the correct role assigned."
    />
  );
}
