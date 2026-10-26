import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/toaster/ToasterContext';
import { importAllInfrastructure, importAdminOrgLookups } from '../Service';

// ── Import options ────────────────────────────────────────────────────────────

type ImportOptionId = 'infra-inventory' | 'admin-org-lookups';

interface ImportOption {
  id: ImportOptionId;
  label: string;
}

const IMPORT_OPTIONS: ImportOption[] = [
  { id: 'infra-inventory', label: 'Import Infrastructure Inventory from RBIA' },
  { id: 'admin-org-lookups', label: 'Import Admin Areas from AAMS and Internal Org Units from IOMS' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the RBIA infrastructure import succeeded, so the page can refresh its counts and lists. */
  onImported?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImported }) => {
  const [selected, setSelected] = useState<Set<ImportOptionId>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const resetAndClose = () => {
    setSelected(new Set());
    setIsImporting(false);
    onClose();
  };

  // X, backdrop and Escape must not close mid-import: the late result would act on a reopened dialog.
  const handleClose = () => {
    if (isImporting) return;
    resetAndClose();
  };

  const toggleItem = (id: ImportOptionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Each selected import reports its own outcome (S06-TC015/TC016: the tester could not tell
  // whether an import worked — the dialog used to close silently and only console.error on failure).
  const handleImport = async () => {
    if (selected.size === 0) return;
    setIsImporting(true);
    const userName = user?.UserId ?? '';

    const tasks: { id: ImportOptionId; label: string; run: () => Promise<string> }[] = [];
    if (selected.has('infra-inventory')) {
      tasks.push({
        id: 'infra-inventory',
        label: 'Infrastructure Inventory',
        run: async () => {
          const { Data } = await importAllInfrastructure(userName);
          const meta = Data?.meta;
          const hasCounts = [meta?.roads, meta?.road_sections, meta?.bridges].every((n) => typeof n === 'number');
          return hasCounts
            ? `Infrastructure Inventory imported from RBIA: ${meta!.roads} roads, ${meta!.road_sections} road sections and ${meta!.bridges} bridges.`
            : 'Infrastructure Inventory imported from RBIA.';
        },
      });
    }
    if (selected.has('admin-org-lookups')) {
      tasks.push({
        id: 'admin-org-lookups',
        label: 'Admin Areas and Internal Org Units',
        run: async () => {
          await importAdminOrgLookups(userName);
          return 'Admin Areas imported from AAMS and Internal Org Units imported from IOMS.';
        },
      });
    }

    const results = await Promise.allSettled(tasks.map((t) => t.run()));
    const succeeded = new Set<ImportOptionId>();
    let anyFailed = false;
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeeded.add(tasks[i].id);
        showToast({ type: 'success', message: result.value });
      } else {
        anyFailed = true;
        console.error('[ImportDialog] Import failed:', result.reason);
        // The interceptor toasted (and set Message) for any API error that carried one.
        if (!(result.reason as { Message?: string } | undefined)?.Message) {
          showToast({ type: 'error', message: `Failed to import ${tasks[i].label}. Please try again.` });
        }
      }
    });

    setIsImporting(false);
    // Only the RBIA import changes roads/sections/bridges; AAMS/IOMS does not touch these lists.
    if (succeeded.has('infra-inventory')) onImported?.();
    if (!anyFailed) {
      resetAndClose();
      return;
    }
    // Stay open on a failure, keeping only the failed imports ticked so a retry doesn't re-run a successful one.
    setSelected((prev) => new Set([...prev].filter((id) => !succeeded.has(id))));
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ArrowUpTrayIcon className="h-5 w-5 text-blue-600" />
              Import Road Network
            </DialogTitle>
            <button onClick={handleClose} disabled={isImporting} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-500 font-medium">Data to Import</p>

            <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
              {IMPORT_OPTIONS.map((option) => (
                <label key={option.id} className="flex items-center gap-2 p-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-400 text-blue-600 cursor-pointer accent-blue-600"
                    checked={selected.has(option.id)}
                    onChange={() => toggleItem(option.id)}
                  />
                  <span className="text-sm font-semibold text-gray-800">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <Button type="button" plain onClick={handleClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              type="button"
              color="blue"
              onClick={handleImport}
              disabled={selected.size === 0 || isImporting}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ImportDialog;
