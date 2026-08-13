import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router keeps the browser's scroll position across route changes
// (e.g. it doesn't reset it the way a fresh page load would), so navigating
// from the bottom of a long page lands mid-scroll on the next one. Jump to
// the top on every route change, with no animation — an instant reset reads
// as "new page", a smooth one reads as a glitch mid-navigation.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // A hash target (e.g. Home's own #for-hospitals anchor) manages its own
    // scroll — don't fight it by forcing the page back to the top first.
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
