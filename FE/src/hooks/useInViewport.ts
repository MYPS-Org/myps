import { useCallback, useEffect, useState } from 'react';

interface UseInViewportOptions {
    /** Passed straight through to IntersectionObserver — how far outside the viewport counts as "visible". */
    rootMargin?: string;
}

/**
 * Reports whether the returned ref's element has scrolled into view. Fires once and disconnects —
 * once a section has loaded, there's no reason to keep observing it. Used to gate lazy data
 * fetches and React.lazy mounts on scroll position instead of loading everything on page mount.
 *
 * Uses a callback ref (not useRef) deliberately: this page shares one useInViewport() instance
 * across a section that renders in more than one tab (e.g. DashboardMacroBudget appears in both
 * the Overview and NEP Briefing tabs). Switching tabs unmounts one occurrence's DOM node and
 * mounts a different one under the same ref — a plain useRef's effect would keep watching the
 * stale, now-detached node. A callback ref re-fires on every attach, so the observer always
 * targets whichever node is actually in the DOM.
 */
export function useInViewport<T extends HTMLElement = HTMLDivElement>(
    options: UseInViewportOptions = {}
) {
    const { rootMargin = '200px' } = options;
    const [node, setNode] = useState<T | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const ref = useCallback((element: T | null) => {
        setNode(element);
    }, []);

    useEffect(() => {
        if (isVisible || !node) return;

        if (typeof IntersectionObserver === 'undefined') {
            // No observer support — fail open rather than never loading the section.
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, isVisible, rootMargin]);

    return { ref, isVisible };
}
