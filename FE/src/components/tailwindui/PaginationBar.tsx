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
    /** Called for numbered page buttons, First, and Last — plain page-jump, no keyset cursors. */
    onGoToPage: (page: number) => void;
    /** Called by the Next button — caller sends keyset Direction: 1 + NextFilteredId. */
    onNext: () => void;
    /** Called by the Previous button — caller sends keyset Direction: 2 + PreviousFilteredId. */
    onPrevious: () => void;
    /** Number of page buttons to show around currentPage (default 7). */
    windowSize?: number;
}

/**
 * Shared pagination bar composed from the tailwindui pagination primitives.
 *
 * Semantic layout:
 *   [First]  [← Previous]  [1][2][3]...[n]  [Next →]  [Last]
 *
 * "First" and "Last" are plain page-jump buttons (page-boundary disabled).
 * "Previous" and "Next" are keyset navigation buttons (hasPrevious/hasNext disabled),
 * which is the key difference from the hand-rolled pagination that previously existed in
 * Program.tsx (where PaginationPrevious/PaginationNext were used for First/Last — a naming bug).
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
             * First: page-jump to page 1.
             * Uses plain Button (not PaginationPrevious) because this is NOT keyset navigation.
             * Disabled when already on page 1.
             */}
            <Button
                plain
                disabled={currentPage <= 1}
                onClick={() => onGoToPage(1)}
                aria-label="First page"
                className="cursor-pointer shrink-0"
            >
                <span className="text-gray-500">First</span>
            </Button>

            {/*
             * Previous: keyset navigation — sends Direction: 2 + PreviousFilteredId.
             * Disabled state comes from the BE response's HasPrevious, not from a page-number check.
             */}
            <PaginationPrevious onClick={onPrevious} disabled={!hasPrevious} />

            {/* Windowed numbered page buttons — each is a plain page-jump (no keyset cursors). */}
            <PaginationList>
                {pages.map((pageNum) => (
                    <PaginationPage
                        key={pageNum}
                        current={pageNum === currentPage}
                        onClick={pageNum !== currentPage ? () => onGoToPage(pageNum) : undefined}
                    >
                        {pageNum}
                    </PaginationPage>
                ))}
            </PaginationList>

            {/*
             * Next: keyset navigation — sends Direction: 1 + NextFilteredId.
             * Disabled state comes from the BE response's HasNext, not from a page-number check.
             */}
            <PaginationNext onClick={onNext} disabled={!hasNext} />

            {/*
             * Last: page-jump to totalPages.
             * Uses plain Button (not PaginationNext) because this is NOT keyset navigation.
             * Disabled when already on the last page.
             */}
            <Button
                plain
                disabled={currentPage >= totalPages}
                onClick={() => onGoToPage(totalPages)}
                aria-label="Last page"
                className="cursor-pointer shrink-0"
            >
                <span className="text-gray-500">Last</span>
            </Button>
        </Pagination>
    );
}
