import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import { importNationalRoads, importRoadSections, importBridges, importAdminOrgLookups } from '../Service';

// Keep these exports so Rbia.tsx doesn't break — they're no longer used internally
// but may be referenced elsewhere.
export type ImportType =
  | 'roads'
  | 'road-section'
  | 'bridges'
  | 'region-data-security'
  | 'city-municipality-legislative-district'
  | 'deo-implementing-office';

export const IMPORT_LABELS: Record<ImportType, string> = {
  'roads': 'Roads',
  'road-section': 'Road Section',
  'bridges': 'Bridges',
  'region-data-security': 'Region',
  'city-municipality-legislative-district': 'City/Municipality, Legislative District',
  'deo-implementing-office': 'DEO, Implementing Office',
};

// ── Tree structure ────────────────────────────────────────────────────────────

interface ImportItem {
  id: ImportType;
  label: string;
}

interface ImportGroup {
  id: string;
  label: string;
  items: ImportItem[];
}

const IMPORT_GROUPS: ImportGroup[] = [
  {
    id: 'road-network',
    label: 'Import Road Network Data from RBIA',
    items: [
      { id: 'roads', label: 'Roads' },
      { id: 'road-section', label: 'Road Section' },
      { id: 'bridges', label: 'Bridges' },
      { id: 'region-data-security', label: 'Region' },
    ],
  },
  {
    id: 'admin-areas',
    label: 'Import Lookup tables from Admin Areas',
    items: [
      { id: 'city-municipality-legislative-district', label: 'City/Municipality, Legislative District' },
    ],
  },
  {
    id: 'internal-org',
    label: 'Import Lookup tables from Internal Org',
    items: [
      { id: 'deo-implementing-office', label: 'DEO, Implementing Office' },
    ],
  },
];

// ── Helper: compute group check state ────────────────────────────────────────

type CheckState = 'all' | 'some' | 'none';

function groupCheckState(group: ImportGroup, selected: Set<ImportType>): CheckState {
  const checkedCount = group.items.filter((i) => selected.has(i.id)).length;
  if (checkedCount === 0) return 'none';
  if (checkedCount === group.items.length) return 'all';
  return 'some';
}

// ── Indeterminate checkbox ────────────────────────────────────────────────────

const IndeterminateCheckbox: React.FC<{
  state: CheckState;
  onChange: () => void;
  id?: string;
}> = ({ state, onChange, id }) => {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === 'some';
      ref.current.checked = state === 'all';
    }
  }, [state]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className="h-4 w-4 rounded border-gray-400 text-blue-600 cursor-pointer accent-blue-600"
      onChange={onChange}
    />
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for API compatibility with Rbia.tsx — not used internally */
  importType?: ImportType | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const [selected, setSelected] = useState<Set<ImportType>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const { user } = useAuth();

  const handleClose = () => {
    setSelected(new Set());
    setIsImporting(false);
    onClose();
  };

  const toggleItem = (id: ImportType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: ImportGroup) => {
    const state = groupCheckState(group, selected);
    setSelected((prev) => {
      const next = new Set(prev);
      if (state === 'all') {
        group.items.forEach((i) => next.delete(i.id));
      } else {
        group.items.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setIsImporting(true);
    const userName = user?.UserName ?? '';
    try {
      const tasks: Promise<unknown>[] = [];
      if (selected.has('roads')) tasks.push(importNationalRoads(userName));
      if (selected.has('road-section')) tasks.push(importRoadSections(userName));
      if (selected.has('bridges')) tasks.push(importBridges(userName));
      // Region, City/Municipality+Legislative District, and DEO+Implementing Office all
      // share the same GIS admin/org lookup import endpoint — call it once if any are checked.
      const wantsAdminOrgLookups =
        selected.has('region-data-security') ||
        selected.has('city-municipality-legislative-district') ||
        selected.has('deo-implementing-office');
      if (wantsAdminOrgLookups) tasks.push(importAdminOrgLookups(userName));
      await Promise.all(tasks);
      handleClose();
    } catch (error) {
      console.error('[ImportDialog] Import failed:', error);
    } finally {
      setIsImporting(false);
    }
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
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-500 font-medium">Road Network to Import</p>

            <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
              {IMPORT_GROUPS.map((group) => {
                const state = groupCheckState(group, selected);
                return (
                  <div key={group.id} className="p-3">
                    {/* Group row */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <IndeterminateCheckbox
                        state={state}
                        onChange={() => toggleGroup(group)}
                        id={`group-${group.id}`}
                      />
                      <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                    </label>

                    {/* Child items */}
                    <div className="mt-2 ml-6 space-y-1.5">
                      {group.items.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-400 text-blue-600 cursor-pointer accent-blue-600"
                            checked={selected.has(item.id)}
                            onChange={() => toggleItem(item.id)}
                          />
                          <span className="text-sm text-gray-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
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
