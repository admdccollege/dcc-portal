import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordForm } from "@/components/password-form";

export default async function ChangePasswordPage() {
  const session = await requireSession();
  return (
    <div className="space-y-6">
      <PageHeader title="Change password" description={`Signed in as ${session.email ?? session.fullName}`} />
      <Card className="max-w-md">
        <CardContent className="pt-5">
          <PasswordForm doneHref="/" />
        </CardContent>
      </Card>
    </div>
  );
}
