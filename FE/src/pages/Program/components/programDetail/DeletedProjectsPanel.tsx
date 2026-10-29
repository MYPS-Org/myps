import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ArchiveBoxIcon, ArrowPathIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../../components/tailwindui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { fetchDeletedProjects } from '../../Service';
import type { DeletedProject } from '../../Model';

interface DeletedProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** vProgramLatest.ProgramId of the current stage, as the batch actions take it. */
  programId: string;
  programName: string;
  stageName: string;
  /** Deleted at this stage: Batch Restore for these ids (toast + table refresh); true when it went through. */
  onRestore: (projectIds: string) => Promise<boolean>;
  /** Deleted at an earlier stage: copied into the current stage (toast + table refresh); true when it went through. */
  onRestoreToCurrentStage: (projectFKs: string[]) => Promise<boolean>;
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const keyOf = (p: DeletedProject) => String(p.RevisionId);
const idOf = (p: DeletedProject) => p.ProjectId || p.ProjectFK;

/**
 * The soft-deleted projects of the program, in two groups:
 *  - deleted at the current stage: Restore un-deletes them here (Batch Restore);
 *  - deleted at an earlier stage the program has since left: advancing never carried them forward,
 *    so Restore copies them INTO the current stage (RestoreToCurrentStage), with the data they had
 *    when deleted; the stages in between are skipped. Restoring them at the old stage would put
 *    them where the program no longer is.
 * The server decides what can be restored (published, Approved program, Lump Sum, ID taken).
 */
const DeletedProjectsPanel: React.FC<DeletedProjectsPanelProps> = ({
  isOpen,
  onClose,
  programId,
  programName,
  stageName,
  onRestore,
  onRestoreToCurrentStage,
}) => {
  const [projects, setProjects] = useState<DeletedProject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!programId) return;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetchDeletedProjects(programId);
      setProjects(response.Data.Projects ?? []);
    } catch (error) {
      console.error('Error loading deleted projects:', error);
      setLoadFailed(true);
    } finally {
      setSelected(new Set());
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const atThisStage = projects.filter((p) => p.DeletedAtCurrentStage);
  const atEarlierStage = projects.filter((p) => !p.DeletedAtCurrentStage);
  const restorable = projects.filter((p) => p.CanRestore);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Restores the given rows through the path each one needs, then reloads the list. */
  const restore = async (rows: DeletedProject[]) => {
    const here = rows.filter((p) => p.DeletedAtCurrentStage && p.CanRestore);
    const forward = rows.filter((p) => !p.DeletedAtCurrentStage && p.CanRestore);
    let any = false;
    if (here.length > 0) any = (await onRestore(here.map(idOf).join(','))) || any;
    if (forward.length > 0) any = (await onRestoreToCurrentStage(forward.map((p) => p.ProjectFK))) || any;
    if (any) await load();
  };

  const renderRows = (rows: DeletedProject[], forward: boolean) => (
    <Table className="min-w-full">
      <TableHead>
        <TableRow>
          <TableHeader className="w-10" />
          <TableHeader>Project ID</TableHeader>
          <TableHeader>Description</TableHeader>
          <TableHeader className="text-right">Cost</TableHeader>
          {forward && <TableHeader>Deleted at</TableHeader>}
          <TableHeader>Deleted by</TableHeader>
          <TableHeader>Deleted on</TableHeader>
          <TableHeader />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((p) => {
          const id = idOf(p);
          const renamed = forward && p.RestoredProjectId && p.RestoredProjectId !== p.ProjectId;
          return (
            <TableRow key={keyOf(p)}>
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Select ${id}`}
                  checked={selected.has(keyOf(p))}
                  disabled={!p.CanRestore}
                  onChange={() => toggle(keyOf(p))}
                />
              </TableCell>
              <TableCell className="font-medium whitespace-nowrap">
                {id}
                {renamed && <div className="text-xs font-normal text-gray-500">becomes {p.RestoredProjectId}</div>}
              </TableCell>
              <TableCell className="max-w-md truncate" title={p.Description ?? ''}>{p.Description || '—'}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{p.Cost != null ? peso.format(p.Cost) : '—'}</TableCell>
              {forward && <TableCell className="whitespace-nowrap">{p.DeletedStageName || '—'}</TableCell>}
              <TableCell className="whitespace-nowrap">{p.DeletedByName || p.DeletedBy || '—'}</TableCell>
              <TableCell className="whitespace-nowrap">{p.DeletedDate ? new Date(p.DeletedDate).toLocaleString() : '—'}</TableCell>
              <TableCell className="text-right">
                <Button
                  color="indigo"
                  disabled={!p.CanRestore}
                  title={p.CanRestore
                    ? (forward ? `Restore ${id} into the ${stageName} stage` : `Restore ${id}`)
                    : `Cannot be restored: ${p.RestoreBlockedReason}`}
                  onClick={() => restore([p])}
                  className="text-xs px-3 py-1.5 whitespace-nowrap"
                >
                  <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                  {forward ? `Restore into ${stageName}` : 'Restore'}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-6xl rounded-lg bg-white shadow-xl flex flex-col max-h-[85vh]">
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ArchiveBoxIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                Deleted projects — {programName}
              </DialogTitle>
              <p className="mt-1 text-sm text-gray-600">
                Projects deleted in this program that can still come back. The program is at the <strong>{stageName}</strong> stage.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close deleted projects">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-gray-500">Loading deleted projects…</p>
            ) : loadFailed ? (
              <p className="py-10 text-center text-sm text-red-600">The deleted projects could not be loaded. Close and try again.</p>
            ) : projects.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No projects have been deleted at this stage.</p>
            ) : (
              <>
                <section aria-label={`Deleted at the ${stageName} stage`}>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Deleted at the {stageName} stage ({atThisStage.length})
                  </h4>
                  {atThisStage.length === 0
                    ? <p className="text-sm text-gray-500">No projects have been deleted at this stage.</p>
                    : renderRows(atThisStage, false)}
                </section>

                {atEarlierStage.length > 0 && (
                  <section aria-label="Deleted at an earlier stage">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      Deleted at an earlier stage ({atEarlierStage.length})
                    </h4>
                    <div role="note" className="mb-3 flex gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      <InformationCircleIcon className="h-5 w-5 flex-shrink-0 text-blue-500" aria-hidden="true" />
                      <span>
                        The program has moved on to the <strong>{stageName}</strong> stage since these projects were deleted.
                        Restoring one adds it to the <strong>{stageName}</strong> stage, with the data it had when it was deleted;
                        the stages in between are skipped. It is not put back at the stage it was deleted at.
                      </span>
                    </div>
                    {renderRows(atEarlierStage, true)}
                  </section>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <span className="text-sm text-gray-600">
              {projects.length} deleted · {restorable.length} can be restored
            </span>
            <div className="flex gap-3">
              <Button color="zinc" onClick={onClose}>Close</Button>
              <Button
                color="indigo"
                disabled={selected.size === 0}
                onClick={() => restore(projects.filter((p) => selected.has(keyOf(p))))}
              >
                Restore selected ({selected.size})
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeletedProjectsPanel;
