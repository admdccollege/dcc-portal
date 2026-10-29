"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type FormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export function PasswordForm({ doneHref }: { doneHref: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, null);
  if (state?.message) {
    return (
      <div className="space-y-4">
        <Alert variant="success">{state.message}</Alert>
        <Button asChild className="w-full"><Link href={doneHref}>Continue</Link></Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" className="w-full" loading={pending}>Update password</Button>
    </form>
  );
}
