import React, { useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ArrowUpTrayIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';

export type ImportType =
  | 'national-roads'
  | 'national-road-sections'
  | 'national-bridges'
  | 'lrps'
  | 'regions-provinces'
  | 'cities-municipalities'
  | 'congressional-districts'
  | 'dpwh-offices';

export const IMPORT_LABELS: Record<ImportType, string> = {
  'national-roads': 'Import National Roads',
  'national-road-sections': 'Import National Road Sections',
  'national-bridges': 'Import National Bridges',
  'lrps': 'Import LRPs',
  'regions-provinces': 'Import Regions and Provinces',
  'cities-municipalities': 'Import Cities and Municipalities',
  'congressional-districts': 'Import Congressional Districts',
  'dpwh-offices': 'Import DPWH Offices',
};

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importType: ImportType | null;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, importType }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = importType ? IMPORT_LABELS[importType] : '';

  const handleClose = () => {
    setSelectedFile(null);
    setIsDragging(false);
    setIsImporting(false);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      alert('Please select a file to import.');
      return;
    }

    setIsImporting(true);
    try {
      // TODO: Replace with actual API import call
      console.log('[ImportDialog] Submitting import:', {
        importType,
        label,
        file: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          lastModified: new Date(selectedFile.lastModified).toISOString(),
        },
      });

      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log('[ImportDialog] Import completed successfully for:', label);
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
              <ArrowUpTrayIcon className="h-5 w-5 text-primary-600" />
              {label}
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Instructions */}
            <p className="text-sm text-gray-600">
              Upload an Excel or CSV file to import <span className="font-medium text-gray-800">{label.replace('Import ', '')}</span> into the system.
            </p>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors duration-200 ${
                isDragging
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
              }`}
            >
              <DocumentArrowUpIcon className="h-10 w-10 text-gray-400" />
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Drag & drop your file here, or{' '}
                    <span className="text-primary-600 font-medium">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" plain onClick={handleClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button type="submit" color="blue" disabled={!selectedFile || isImporting}>
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ImportDialog;
