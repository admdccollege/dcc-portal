import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="space-y-6">
      <div className="space-y-1 lg:hidden">
        <p className="text-sm font-semibold text-primary">Damdei Christian College</p>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <p className="text-sm text-muted-foreground">Use the account issued by the college office.</p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
