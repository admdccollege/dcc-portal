import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Verify a mark statement" };

async function go(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
  if (code) redirect(`/verify/${code}`);
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3"><ShieldCheck className="size-8 text-primary" /><div><h1 className="text-lg font-semibold">Verify a mark statement</h1><p className="text-sm text-muted-foreground">Damdei Christian College</p></div></div>
        <form action={go} className="space-y-3">
          <Label htmlFor="code">Verification code</Label>
          <Input id="code" name="code" required placeholder="e.g. F7515A766179" autoComplete="off" className="font-mono uppercase" />
          <Button type="submit" className="w-full">Verify</Button>
        </form>
        <p className="text-xs text-muted-foreground">The code is printed at the bottom of every college-issued statement of marks, next to the QR code.</p>
      </div>
    </main>
  );
}
