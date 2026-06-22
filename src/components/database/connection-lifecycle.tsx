"use client";

import { useEffect } from "react";
import { disconnectSessionOnUnload } from "@/lib/api-client";

export function ConnectionLifecycle() {
  useEffect(() => {
    const handlePageHide = (event: PageTransitionEvent) => {
      // Skip when the page enters the back/forward cache — user may return.
      if (event.persisted) return;
      disconnectSessionOnUnload();
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  return null;
}
