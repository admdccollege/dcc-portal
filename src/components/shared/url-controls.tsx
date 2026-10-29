"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type UrlControl =
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; placeholder?: string; resets?: string[]; width?: string }
  | { name: string; label: string; type: "date" | "month" | "number"; min?: string; max?: string; width?: string; defaultValue?: string };

/** Labelled controls whose values live in the URL query string. */
export function UrlControls({ controls }: { controls: UrlControl[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Latest requested query: rapid successive changes must build on each other,
  // not on search params that have not re-rendered yet.
  const latest = useRef<string | null>(null);
  useEffect(() => { latest.current = null; }, [params]);

  const set = (name: string, value: string, resets: string[] = []) => {
    const next = new URLSearchParams(latest.current ?? params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    for (const r of resets) next.delete(r);
    latest.current = next.toString();
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("no-print flex flex-wrap items-end gap-3", pending && "opacity-70")}>
      {controls.map((c) => (
        <div key={c.name} className={cn("space-y-1.5", c.width ?? "w-full sm:w-52")}>
          <Label htmlFor={`uc-${c.name}`}>{c.label}</Label>
          {c.type === "select" ? (
            <NativeSelect id={`uc-${c.name}`} value={params.get(c.name) ?? ""} onChange={(e) => set(c.name, e.target.value, c.resets)}>
              <option value="">{c.placeholder ?? "Select…"}</option>
              {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          ) : (
            <Input id={`uc-${c.name}`} type={c.type} min={c.min} max={c.max} value={params.get(c.name) ?? c.defaultValue ?? ""} onChange={(e) => set(c.name, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}
