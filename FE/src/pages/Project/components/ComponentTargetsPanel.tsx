import React, { useCallback } from 'react';
import { fetchProjectStageTargets } from '../Service';
import type { ProjectStageTarget, ProjectStageTargetFilter } from '../Model.d';
import { usePagination } from '../../../hooks/usePagination';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';

interface ComponentTargetsPanelProps {
    /** ProjectPK of the project being viewed (ProjectDetails.ProjectFK). */
    projectPK: string;
    /** Bare component id (e.g. "CW1"), not the "{ProjectId}-{ComponentId}" display code. */
    componentId: string;
}

const formatTarget = (target?: number | null) =>
    target === null || target === undefined
        ? '—'
        : target.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One component's physical targets at every Program Stage the project has undergone, shown
 * when a component row is expanded on the project details page. Mirrors the legacy desktop
 * app's per-project Targets tab.
 *
 * This is a separate component on purpose: it mounts when a component expands and unmounts
 * when it collapses, so usePagination's internal cursor state resets to page 1 for free
 * rather than needing manual clearing in the parent.
 */
const ComponentTargetsPanel: React.FC<ComponentTargetsPanelProps> = ({ projectPK, componentId }) => {
    // ShowProjectStageTargets needs ProjectId alongside the generic usePagination hook's
    // PaginatedRequest — adapt it into that shape here, same as ProgramDetail does for
    // ShowProjectsInProgram. The hook threads Navigation/cursors correctly per request.
    const fetchTargets = useCallback(
        async (params: PaginatedRequest<ProjectStageTargetFilter>) => {
            const response = await fetchProjectStageTargets({
                Filters: { ...params.Filters, ComponentId: componentId },
                limit: params.limit,
                page: params.page,
                Navigation: params.Navigation ?? 0,
                PreviousFilteredId: params.PreviousFilteredId ?? 0,
                NextFilteredId: params.NextFilteredId ?? 0,
                PageCursorId: params.PageCursorId ?? 0,
                ProjectId: projectPK,
            });
            return response;
        },
        [projectPK, componentId]
    );

    const pagination = usePagination<ProjectStageTargetFilter, ProjectStageTarget>(fetchTargets, {
        initialFilters: { ComponentId: componentId },
        limit: 10,
    });

    return (
        <div>
            <Table className="mb-0">
                <TableHead>
                    <TableRow>
                        <TableHeader justify="center" className="text-xs">Source</TableHeader>
                        <TableHeader justify="center" className="text-xs">Component ID</TableHeader>
                        <TableHeader justify="center" className="text-xs">Component Description</TableHeader>
                        <TableHeader justify="center" className="text-xs">Type of Work</TableHeader>
                        <TableHeader justify="center" className="text-xs">Target</TableHeader>
                        <TableHeader justify="center" className="text-xs">Target Unit</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {pagination.data.lists.length > 0 ? (
                        pagination.data.lists.map((target) => (
                            <TableRow key={target.Id}>
                                <TableCell className="text-sm text-gray-600 text-center">{target.Source?.trim() || '—'}</TableCell>
                                <TableCell className="font-medium text-sm text-center">
                                    {target.ComponentCode || target.ComponentId || '—'}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">{target.ComponentDescription || '—'}</TableCell>
                                <TableCell className="text-sm text-gray-600">{target.TypeOfWork || '—'}</TableCell>
                                <TableCell className="text-sm font-medium text-right">{formatTarget(target.Target)}</TableCell>
                                <TableCell className="text-sm text-gray-600 text-center">{target.TargetUnit || '—'}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                                {pagination.isLoading ? 'Loading targets...' : 'No targets available for this component'}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {pagination.data.totalPages > 1 && (
                <PaginationBar
                    currentPage={pagination.data.page}
                    totalPages={pagination.data.totalPages}
                    hasPrevious={pagination.hasPrevious}
                    hasNext={pagination.hasNext}
                    onGoToPage={pagination.goToPage}
                    onNext={pagination.goNext}
                    onPrevious={pagination.goPrevious}
                    onFirst={pagination.goFirst}
                    onLast={pagination.goLast}
                    isLoading={pagination.isLoading}
                />
            )}
        </div>
    );
};

export default ComponentTargetsPanel;
