"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

/**
 * Runs a server action with pending state, toast feedback and router refresh.
 * Returns the result so callers can react (e.g. close a dialog, show field errors).
 */
export function useServerAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: { success?: string | ((data: T) => string); onSuccess?: (data: T) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void; refresh?: boolean } = {},
  ) {
    return new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        try {
          const res = await action();
          if (res.ok) {
            const msg = typeof opts.success === "function" ? opts.success(res.data) : (opts.success ?? res.message);
            if (msg) toast.success(msg);
            opts.onSuccess?.(res.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            toast.error(res.error);
            opts.onError?.(res);
          }
          resolve(res);
        } catch {
          const res = { ok: false as const, error: "Network or server error. Please try again." };
          toast.error(res.error);
          resolve(res);
        }
      });
    });
  }

  return { pending, run };
}
