import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Scrolls to the top of the page whenever the route changes.
 * Use this in App.tsx or a top-level layout component.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      document.title = `${heading.textContent?.trim() || "Anchor"} · Anchor`;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  return null;
}
