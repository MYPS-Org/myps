import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Gap kept between the app's top bar and the pinned header. */
const PIN_GAP_PX = 8;

/**
 * Keeps the dashboard header (its fiscal year, category and data-source filters) on screen while
 * the page scrolls, so every section below visibly sits under those filters.
 *
 * Not CSS `position: sticky`: SidebarLayout wraps every page in an `overflow-auto` box that never
 * scrolls itself (the window does), and a sticky element sticks to its nearest overflow box, so
 * it would never move. Instead the header switches to `position: fixed` once a zero-height marker
 * left in its place reaches the bottom of the app's top bar (`[data-app-navbar]`). The marker also
 * gives the pinned header its left edge and width, so it stays aligned with the content column
 * whatever the sidebar does, and a spacer of the header's own height keeps the page from jumping.
 */
export function usePinnedHeader() {
  const markerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedStyle, setPinnedStyle] = useState<CSSProperties>({});
  const [spacerHeight, setSpacerHeight] = useState(0);
  // The header's in-flow height, captured while unpinned: pinned, it is shorter (compact).
  const unpinnedHeightRef = useRef(0);

  const update = useCallback(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const navbarBottom = Array.from(document.querySelectorAll<HTMLElement>('[data-app-navbar]'))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.height > 0)
      .reduce((bottom, rect) => Math.max(bottom, rect.bottom), 0);

    const markerRect = marker.getBoundingClientRect();
    const shouldPin = markerRect.top < navbarBottom;

    if (!shouldPin && headerRef.current) {
      unpinnedHeightRef.current = headerRef.current.offsetHeight;
    }
    setIsPinned(shouldPin);
    setSpacerHeight(unpinnedHeightRef.current);
    setPinnedStyle({
      top: navbarBottom,
      left: markerRect.left,
      width: markerRect.width,
      paddingTop: PIN_GAP_PX,
      paddingBottom: PIN_GAP_PX,
    });
  }, []);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    // Capture phase: also hears a scroll from any inner scroll box, should the layout ever
    // move scrolling off the window.
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, [update]);

  return { markerRef, headerRef, isPinned, pinnedStyle, spacerHeight };
}
