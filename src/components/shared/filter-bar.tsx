"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterDef = { name: string; label: string; options: FilterOption[]; allLabel?: string };

/** Search + dropdown filters synchronised with the URL (server components read searchParams). */
export function FilterBar({ filters = [], searchPlaceholder = "Search…", showSearch = true, children }: {
  filters?: FilterDef[];
  searchPlaceholder?: string;
  showSearch?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<string | null>(null);
  useEffect(() => { latest.current = null; }, [params]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(latest.current ?? params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    latest.current = next.toString();
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const active = filters.some((f) => params.get(f.name)) || !!params.get("q");

  return (
    <div className={cn("no-print flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end", pending && "opacity-70")}>
      {showSearch && (
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search"
            placeholder={searchPlaceholder}
            value={q}
            className="pl-8"
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => update("q", v.trim()), 350);
            }}
          />
        </div>
      )}
      {filters.map((f) => (
        <div key={f.name} className="sm:w-48">
          <label className="sr-only" htmlFor={`filter-${f.name}`}>{f.label}</label>
          <NativeSelect id={`filter-${f.name}`} value={params.get(f.name) ?? ""} onChange={(e) => update(f.name, e.target.value)}>
            <option value="">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </div>
      ))}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X /> Clear
        </Button>
      )}
      {children}
    </div>
  );
}
