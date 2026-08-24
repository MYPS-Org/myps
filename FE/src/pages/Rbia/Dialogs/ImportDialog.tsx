import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
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
}

// ── Component ─────────────────────────────────────────────────────────────────

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const [selected, setSelected] = useState<Set<ImportOptionId>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const { user } = useAuth();

  const handleClose = () => {
    setSelected(new Set());
    setIsImporting(false);
    onClose();
  };

  const toggleItem = (id: ImportOptionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setIsImporting(true);
    const userName = user?.UserId ?? '';
    try {
      const tasks: Promise<unknown>[] = [];
      if (selected.has('infra-inventory')) tasks.push(importAllInfrastructure(userName));
      if (selected.has('admin-org-lookups')) tasks.push(importAdminOrgLookups(userName));
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
