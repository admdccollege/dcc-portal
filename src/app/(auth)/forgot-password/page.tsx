"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Reset password</h2>
        <p className="text-sm text-muted-foreground">We will email you a link to choose a new password.</p>
      </div>
      <form action={action} className="space-y-4">
        {state?.error && <Alert variant="error">{state.error}</Alert>}
        {state?.message && <Alert variant="success">{state.message}</Alert>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full" loading={pending}>Send reset link</Button>
      </form>
      <Link href="/login" className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
    </div>
  );
}
