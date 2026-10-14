/**
 * Keeps an element where it is on screen while the page re-lays out around it.
 *
 * Choosing a year or a category reloads every Dashboard section, and the sections above the one
 * the user is looking at change height as they reload; with nothing holding the page, the clicked
 * chart slid off screen (406 px → −110 px on a 1366×768 window) and came back when the data
 * landed. This checks the anchor once per frame and scrolls back by however far it moved, before
 * the frame is painted, so the user sees no jump. Per frame rather than on resize: a section
 * shrinking above while another grows below leaves the page's height unchanged but still moves
 * the anchor.
 *
 * While a hold is active the browser's own scroll anchoring is switched off, so this is the only
 * thing that scrolls the page by itself: any other change of scroll position is the user's (a
 * wheel, keys, touch, the scrollbar, or a script), and it ends the hold at once. So do pointer,
 * wheel, touch and key events, the anchor leaving the page, HOLD_MAX_MS (a cold fiscal year can
 * take ~17 s to reload), and the next hold starting.
 */
const HOLD_MAX_MS = 30_000;
const RELEASE_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

let releaseActiveHold: (() => void) | null = null;

export function holdScrollPosition(anchor: Element): () => void {
  releaseActiveHold?.();

  const root = document.documentElement;
  const previousOverflowAnchor = root.style.overflowAnchor;
  root.style.overflowAnchor = 'none';

  const startTop = anchor.getBoundingClientRect().top;
  const startedAt = performance.now();
  let lastScrollY = window.scrollY;
  let frame = 0;

  const release = () => {
    cancelAnimationFrame(frame);
    RELEASE_EVENTS.forEach((type) => window.removeEventListener(type, release, true));
    root.style.overflowAnchor = previousOverflowAnchor;
    if (releaseActiveHold === release) releaseActiveHold = null;
  };

  const correct = () => {
    // Scrolled since the last frame, and not by this hold: the user is scrolling. Let them.
    if (!anchor.isConnected || window.scrollY !== lastScrollY || performance.now() - startedAt > HOLD_MAX_MS) {
      release();
      return;
    }
    const drift = anchor.getBoundingClientRect().top - startTop;
    if (Math.abs(drift) >= 1) window.scrollBy(0, drift);
    lastScrollY = window.scrollY;
    frame = requestAnimationFrame(correct);
  };

  // Added from within the click that starts the hold: that click's own pointerdown (or keydown)
  // has already fired, so it cannot end the hold it starts.
  RELEASE_EVENTS.forEach((type) => window.addEventListener(type, release, { capture: true, passive: true }));
  frame = requestAnimationFrame(correct);
  releaseActiveHold = release;
  return release;
}
