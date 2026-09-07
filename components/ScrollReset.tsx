"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// The app's scrollable region is this div, not the window (layout.tsx gives it its
// own `overflow: auto`), so Next's built-in scroll-to-top on navigation — which only
// resets window scroll — never resets it. Without this, opening a detail page while
// scrolled down a list leaves the new page rendered below the fold until the user
// manually scrolls up.
export default function ScrollReset({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 24 }}>
      {children}
    </div>
  );
}
