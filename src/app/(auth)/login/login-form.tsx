"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type FormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" loading={pending}>Sign in</Button>
    </form>
  );
}
