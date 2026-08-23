import { Button } from './button';
import {
    Pagination,
    PaginationPrevious,
    PaginationNext,
    PaginationList,
    PaginationPage,
} from './pagination';

interface PaginationBarProps {
    currentPage: number;
    totalPages: number;
    /** Driven by the BE response's HasPrevious (falls back to page > 1 if omitted). */
    hasPrevious: boolean;
    /** Driven by the BE response's HasNext (falls back to page < totalPages if omitted). */
    hasNext: boolean;
    /**
     * Called for numbered page buttons. Safe to call for any page — the BE's keyset pagination has
     * no OFFSET-style random access, so the caller (usePagination.goToPage) walks there hop-by-hop
     * behind the scenes if it hasn't been visited yet, then renders only the final result.
     */
    onGoToPage: (page: number) => void;
    /** Called by the Next button — caller sends keyset Navigation: Next + NextFilteredId. */
    onNext: () => void;
    /** Called by the Previous button — caller sends keyset Navigation: Previous + PreviousFilteredId. */
    onPrevious: () => void;
    /** Called by the First button — caller sends Navigation: First (one-shot, no cursor). */
    onFirst: () => void;
    /** Called by the Last button — caller sends Navigation: Last (one-shot, no cursor). */
    onLast: () => void;
    /**
     * Disables every control while true. Pass the hook's `isLoading` — a numbered-page click may
     * trigger several chained requests under the hood (see onGoToPage), so this prevents a second
     * click from racing an in-flight walk.
     */
    isLoading?: boolean;
    /** Number of page buttons to show around currentPage (default 7). */
    windowSize?: number;
}

/**
 * Shared pagination bar composed from the tailwindui pagination primitives.
 *
 * Semantic layout:
 *   [First]  [← Previous]  [1][2][3]...[n]  [Next →]  [Last]
 *
 * "First" and "Last" are one-shot BE lookups (Navigation: First/Last, page-boundary disabled).
 * "Previous" and "Next" are keyset navigation (hasPrevious/hasNext disabled). Numbered page
 * buttons are keyset "Page" jumps — see onGoToPage for how an unvisited page is resolved.
 *
 * Returns null when totalPages <= 1 (no bar needed).
 */
export function PaginationBar({
    currentPage,
    totalPages,
    hasPrevious,
    hasNext,
    onGoToPage,
    onNext,
    onPrevious,
    onFirst,
    onLast,
    isLoading = false,
    windowSize = 7,
}: PaginationBarProps) {
    if (totalPages <= 1) return null;

    // Build the windowed page list centered around currentPage.
    const startPage = Math.max(1, currentPage - Math.floor(windowSize / 2));
    const pages: number[] = Array.from(
        { length: Math.min(windowSize, totalPages - startPage + 1) },
        (_, i) => startPage + i
    ).filter((p) => p <= totalPages);

    return (
        <Pagination className="my-6">
            {/*
             * First: one-shot jump to page 1 (Navigation: First).
             * Uses plain Button (not PaginationPrevious) because this is not keyset Next/Previous.
             * Disabled when already on page 1.
             */}
            <Button
                plain
                disabled={isLoading || currentPage <= 1}
                onClick={onFirst}
                aria-label="First page"
                className="cursor-pointer shrink-0"
            >
                <span className="text-gray-500">First</span>
            </Button>

            {/*
             * Previous: keyset navigation — sends Navigation: Previous + PreviousFilteredId.
             * Disabled state comes from the BE response's HasPrevious, not from a page-number check.
             */}
            <PaginationPrevious onClick={onPrevious} disabled={isLoading || !hasPrevious} />

            {/* Windowed numbered page buttons — each is a keyset "Page" jump (walked if unvisited). */}
            <PaginationList>
                {pages.map((pageNum) => (
                    <PaginationPage
                        key={pageNum}
                        current={pageNum === currentPage}
                        disabled={isLoading}
                        onClick={pageNum !== currentPage ? () => onGoToPage(pageNum) : undefined}
                    >
                        {pageNum}
                    </PaginationPage>
                ))}
            </PaginationList>

            {/*
             * Next: keyset navigation — sends Navigation: Next + NextFilteredId.
             * Disabled state comes from the BE response's HasNext, not from a page-number check.
             */}
            <PaginationNext onClick={onNext} disabled={isLoading || !hasNext} />

            {/*
             * Last: one-shot jump to the last page (Navigation: Last, derived from the total count).
             * Uses plain Button (not PaginationNext) because this is not keyset Next/Previous.
             * Disabled when already on the last page.
             */}
            <Button
                plain
                disabled={isLoading || currentPage >= totalPages}
                onClick={onLast}
                aria-label="Last page"
                className="cursor-pointer shrink-0"
            >
                <span className="text-gray-500">Last</span>
            </Button>
        </Pagination>
    );
}
