import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="size-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="max-w-md text-sm text-muted-foreground">You do not have permission to view this page. If you believe this is a mistake, contact the administrator.</p>
      <Button asChild variant="outline"><Link href="/">Go to my dashboard</Link></Button>
    </div>
  );
}
