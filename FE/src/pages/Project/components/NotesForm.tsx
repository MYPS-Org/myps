import React, { useState } from "react";
import type { ProjectNote } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import AddNoteDialog from "../dialogs/AddNoteDialog";

interface NotesFormProps {
  notes: ProjectNote[];
  onAdd: () => void;
  onEdit: (index: number, updatedNote: ProjectNote) => void;
  onDelete: (index: number) => void;
  onFileChange?: (index: number, file: File) => void; // Optional if upload handled externally
  initialData?: any; // Optional initial data for dropdowns or other purposes
}

const NotesForm: React.FC<NotesFormProps> = ({
  notes,
  onAdd,
  onEdit,
  onDelete,
  onFileChange,
  initialData
}) => {
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);

  const handleAddNote = (note: ProjectNote) => {
    setLocalNotes(prev => [...prev, note]);
    if (onAdd) onAdd(); // Optionally notify parent
  };

  const handleLog = () => {
    console.log('Notes:', initialData.ProjectDetails?.ReferenceId);
  };

  const handleFileChange = (index: number, file: File) => {
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop() || '';

    const updatedNote: ProjectNote = {
      ...notes[index],
      FileName: fileName,
      FileExtension: fileExtension,
      FilePath: URL.createObjectURL(file), // preview only, not actual path
    };

    onEdit(index, updatedNote);
    if (onFileChange) onFileChange(index, file); // optional actual upload
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Project Notes</h2>
        <Button color="blue" onClick={() => setIsAddNoteModalOpen(true)}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Note
        </Button>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Description</TableHeader>
            <TableHeader>Date</TableHeader>
            <TableHeader>File</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {notes.map((note, index) => (
            <TableRow key={note.Id || index}>
              <TableCell>
                <textarea
                  value={note.Description}
                  onChange={(e) =>
                    onEdit(index, { ...note, Description: e.target.value })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                  placeholder="Enter note description"
                  rows={1}
                />
              </TableCell>
              <TableCell>
                <input
                  type="date"
                  value={note.CreatedDate}
                  onChange={(e) =>
                    onEdit(index, { ...note, CreatedDate: e.target.value })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
              </TableCell>
              <TableCell>
                <div className="w-full px-2 py-1 border border-gray-300 rounded">
                  <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileChange(index, file);
                    }
                  }}
                  className="w-full cursor-pointer"
                />
                {note.FileName && (
                  <span className="text-xs text-gray-500 block mt-1">{note.FileName}</span>
                )}
                </div>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onDelete(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog */}
      <AddNoteDialog
        isOpen={isAddNoteModalOpen}
        onClose={() => setIsAddNoteModalOpen(false)}
        projectId={initialData?.ProjectDetails?.ReferenceId || 0}
        onAddNote={handleAddNote}
      />
      
    </div>
  );
};

export default NotesForm;
