import "server-only";
import { z } from "zod";
import { getSession, can, type Session } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { friendlyDbError } from "@/lib/db-errors";
import { rateLimit } from "@/lib/rate-limit";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export class ActionError extends Error {}

type Options = {
  /** Caller must hold ANY of these permissions (checked server-side). */
  permission?: Permission | Permission[];
  /** Max calls per user per minute (in-memory, per server instance). */
  rateLimitPerMinute?: number;
};

/**
 * Wraps a server action with: authentication, permission check, input
 * validation (zod), rate limiting and consistent error mapping. The database
 * re-checks permissions via RLS / SECURITY DEFINER functions (defence in depth).
 */
export function createAction<S extends z.ZodType, T>(
  schema: S,
  opts: Options,
  handler: (input: z.infer<S>, session: Session) => Promise<T | ActionResult<T>>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const session = await getSession();
    if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };

    const perms = opts.permission ? (Array.isArray(opts.permission) ? opts.permission : [opts.permission]) : [];
    if (perms.length && !can(session, ...perms)) {
      return { ok: false, error: "You are not authorised to perform this action." };
    }
    if (opts.rateLimitPerMinute && !rateLimit(`action:${session.userId}:${handler.name}`, opts.rateLimitPerMinute)) {
      return { ok: false, error: "Too many requests. Please wait a minute and try again." };
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      };
    }

    try {
      const result = await handler(parsed.data, session);
      if (result && typeof result === "object" && "ok" in result) return result as ActionResult<T>;
      return { ok: true, data: result as T };
    } catch (err) {
      if (err instanceof ActionError) return { ok: false, error: err.message };
      // Next.js control-flow errors (redirect/notFound) must propagate.
      if (err && typeof err === "object" && "digest" in err) throw err;
      console.error("[action error]", err);
      return { ok: false, error: friendlyDbError(err) };
    }
  };
}

/** Throws an ActionError for a Supabase error object (PostgrestError). */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw new ActionError(friendlyDbError(res.error));
  return res.data;
}

/** Like check(), but also throws when no row is returned (for .single() reads). */
export function one<T>(res: { data: T; error: unknown }, notFound = "Record not found or access denied."): NonNullable<T> {
  if (res.error) throw new ActionError(friendlyDbError(res.error));
  if (res.data === null || res.data === undefined) throw new ActionError(notFound);
  return res.data;
}
