import React, { Suspense } from 'react';

interface LazySectionProps {
  /** From useInViewport — whether this section has scrolled into view yet. */
  isVisible: boolean;
  /** From useInViewport — attach to the wrapping div so the observer has a node to watch. */
  sectionRef: React.Ref<HTMLDivElement>;
  /** Shown before the section is visible, and as the Suspense fallback while its React.lazy
   *  chunk loads once visible — one visual treatment for both "not reached yet" and "loading". */
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Gates a dashboard section behind viewport visibility: renders the skeleton until the section
 * scrolls into view, then mounts `children` (typically a React.lazy-wrapped component) inside a
 * Suspense boundary. Pair with useInViewport, and pass the same `isVisible` flag to the section's
 * data hook so the fetch and the code-split chunk load together.
 */
export function LazySection({ isVisible, sectionRef, skeleton, children }: LazySectionProps) {
  return (
    <div ref={sectionRef}>
      {isVisible ? <Suspense fallback={skeleton}>{children}</Suspense> : skeleton}
    </div>
  );
}

export default LazySection;
