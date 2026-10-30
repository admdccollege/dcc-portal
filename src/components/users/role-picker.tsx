"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ROLES, ROLE_KEYS } from "@/lib/auth/permissions";

/**
 * Role checkboxes. The Student role is exclusive: choosing it clears staff roles
 * and choosing a staff role clears Student. Only a Super Administrator may grant
 * (or remove) Super Administrator.
 */
export function RolePicker({ value, onChange, canGrantSuper, idPrefix }: {
  value: string[];
  onChange: (roles: string[]) => void;
  canGrantSuper: boolean;
  idPrefix: string;
}) {
  const toggle = (role: string, on: boolean) => {
    if (!on) return onChange(value.filter((r) => r !== role));
    if (role === "student") return onChange(["student"]);
    onChange([...value.filter((r) => r !== "student"), role]);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Roles <span className="text-destructive" aria-hidden>*</span></legend>
      {ROLE_KEYS.map((r) => {
        const id = `${idPrefix}-role-${r}`;
        const locked = r === "super_admin" && !canGrantSuper;
        return (
          <label key={r} htmlFor={id} className={`flex items-start gap-2 rounded-md border p-2 text-sm ${value.includes(r) ? "border-primary/50 bg-primary/5" : "border-transparent"} ${locked ? "opacity-60" : "cursor-pointer"}`}>
            <Checkbox id={id} className="mt-0.5" checked={value.includes(r)} disabled={locked} onCheckedChange={(c) => toggle(r, c === true)} />
            <span>
              <span className="font-medium">{ROLES[r].name}</span>
              <span className="block text-xs text-muted-foreground">{ROLES[r].description}{locked ? " — Super Administrators only" : ""}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
