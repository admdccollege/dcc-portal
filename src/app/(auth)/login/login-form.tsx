"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInDemo, type FormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";

export function LoginForm({ next, demo = false, demoFailed = false }: { next?: string; demo?: boolean; demoFailed?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null);
  const [demoState, demoAction, demoPending] = useActionState<FormState, FormData>(signInDemo, null);
  return (
    <div className="space-y-5">
      {demo && (
        <form action={demoAction} className="space-y-3 rounded-lg border border-dashed p-4">
          {demoState?.error && <Alert variant="error">{demoState.error}</Alert>}
          {demoFailed && !demoState && (
            <Alert variant="error">Automatic demo sign-in failed. Check the demo account settings on the server.</Alert>
          )}
          <input type="hidden" name="next" value={next ?? ""} />
          <Button type="submit" className="w-full" loading={demoPending}>
            Bypass Login / Demo Mode
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Goes straight to the dashboard. Or sign in below with <span className="font-mono">admin</span> /{" "}
            <span className="font-mono">password123</span>.
          </p>
        </form>
      )}
      <form action={action} className="space-y-4" noValidate>
        {state?.error && <Alert variant="error">{state.error}</Alert>}
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="space-y-2">
          <Label htmlFor="email">{demo ? "Email or username" : "Email"}</Label>
          <Input
            id="email"
            name="email"
            type={demo ? "text" : "email"}
            autoComplete="username"
            required
            autoFocus={!demo}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" variant={demo ? "outline" : undefined} loading={pending}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
