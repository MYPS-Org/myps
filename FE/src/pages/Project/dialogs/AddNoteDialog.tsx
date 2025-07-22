import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { AddNotes, ProjectNote } from '../Model.d';
import { addNote } from '../Service';

interface AddNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onAddNote: (note: ProjectNote) => void;
}

const AddNoteDialog: React.FC<AddNoteDialogProps> = ({ isOpen, onClose, projectId, onAddNote }) => {
  const [formData, setFormData] = useState<AddNotes>({
    ProjectId: projectId,
    Description: '',
    File: null as unknown as File, // Ensures File is nullable
  });

  const [submitting, setSubmitting] = useState(false);

  // Update ProjectId if it changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      ProjectId: projectId,
    }));
  }, [projectId]);

  const handleChange = (field: keyof AddNotes, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
        console.log('Note added:', formData);
        const response = await addNote(formData);
        // if (response?.Data) {
        //     const newNote: ProjectNote = {
        //     Id: 0,
        //     ProjectId: projectId,
        //     Description: response.Data.Description,
        //     FileName: '',
        //     FileExtension: '',
        //     FilePath: '',
        //     CreatedBy: '',
        //     CreatedDate: new Date().toISOString(),
        //     };
        //     onAddNote(newNote);
        // }
        setFormData({
            ProjectId: projectId,
            Description: '',
            File: null as unknown as File,
        });
        onClose();
        } catch (error) {
        console.error('Error adding note:', error);
        } finally {
        setSubmitting(false);
        }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add Note
            </DialogTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <textarea
              value={formData.Description}
              onChange={e => handleChange('Description', e.target.value)}
              placeholder="Note description"
              className="w-full border rounded p-2"
              required
            />
            <div className="w-full px-2 py-1 border border-gray-300 rounded">
              <input
                type="file"
                onChange={e => handleChange('File', e.target.files?.[0] || null)}
                className="w-full"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="blue" disabled={submitting}>
                Submit
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddNoteDialog;
