"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";

const SW_ENABLED = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function postToWorker(message: Record<string, unknown>) {
  navigator.serviceWorker?.controller?.postMessage(message);
}

/**
 * Registers the service worker (public/sw.js), saves each page the user opens
 * for offline reading, clears saved pages on the sign-in screen, and shows a
 * banner while the device is offline.
 */
export function OfflineSupport() {
  const pathname = usePathname();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    if (SW_ENABLED && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!SW_ENABLED || !("serviceWorker" in navigator)) return;
    if (pathname.startsWith("/login") || pathname.startsWith("/forgot-password")) {
      postToWorker({ type: "clear-pages" });
      return;
    }
    if (navigator.onLine) {
      // Give the page a moment to settle so the saved copy matches what was shown.
      const t = setTimeout(() => postToWorker({ type: "save-page", url: window.location.pathname + window.location.search }), 1200);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (online) return null;
  return (
    <div role="status" className="no-print fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-center text-sm font-medium text-amber-950 shadow-lg">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      You&apos;re offline — showing pages saved on this device. Changes can&apos;t be saved until you reconnect.
    </div>
  );
}

/** Tell the service worker to forget saved pages (used on sign-out). */
export function clearOfflinePages() {
  if (typeof navigator !== "undefined") postToWorker({ type: "clear-pages" });
}
