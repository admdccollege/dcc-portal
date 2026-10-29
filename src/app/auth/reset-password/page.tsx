import { PasswordForm } from "@/components/password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">At least 10 characters, including a letter and a number.</p>
        </div>
        <PasswordForm doneHref="/" />
      </div>
    </div>
  );
}
