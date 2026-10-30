"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { OfflineSupport } from "@/components/offline/offline-support";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
      <Toaster richColors closeButton position="top-right" />
      <OfflineSupport />
    </ThemeProvider>
  );
}
