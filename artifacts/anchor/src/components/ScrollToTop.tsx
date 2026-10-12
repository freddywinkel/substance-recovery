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
    let userInteracted = false;
    let finished = false;
    let frame = 0;
    const markInteraction = () => { userInteracted = true; };
    const completeNavigation = () => {
      frame = 0;
      if (finished) return;
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      finished = true;
      observer.disconnect();
      if (!userInteracted) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      document.title = `${heading.textContent?.trim() || "Anchor"} · Anchor`;
    };
    const scheduleNavigation = () => {
      if (!finished && !frame) frame = window.requestAnimationFrame(completeNavigation);
    };
    // Lazy routes can still be showing their loading fallback on the first frame.
    const observer = new MutationObserver(scheduleNavigation);
    observer.observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", markInteraction, true);
    document.addEventListener("keydown", markInteraction, true);
    scheduleNavigation();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", markInteraction, true);
      document.removeEventListener("keydown", markInteraction, true);
    };
  }, [location]);

  return null;
}
