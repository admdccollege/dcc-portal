"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16">
      <Alert variant="error" title="Something went wrong">
        The page could not be loaded. Please try again. {error.digest && <span className="block text-xs">Reference: {error.digest}</span>}
      </Alert>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
