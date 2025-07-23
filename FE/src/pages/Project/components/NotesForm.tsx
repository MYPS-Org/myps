import React, { useState } from "react";
import type { ProjectNote } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import AddNoteDialog from "../dialogs/AddNoteDialog";

interface NotesFormProps {
  notes: ProjectNote[];
  onAdd: (newNote: ProjectNote) => void;
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

  // Add this function to handle adding a new note
  const handleAddNote = (newNote: ProjectNote) => {
    console.log('Adding new note to table:', newNote);
    console.log('Current notes before adding:', notes);
    onAdd(newNote);
    setIsAddNoteModalOpen(false);
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
            <TableRow key={`${note.Id}-${index}-${note.CreatedDate}`}>
              <TableCell>
                
                  <span title={note.Description} className="text-xs text-gray-500 mt-1">{note.Description}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-gray-500 mt-1">{note.CreatedDate ? new Date(note.CreatedDate).toLocaleDateString() : '-'}</span>
                
              </TableCell>
              <TableCell>
                {note.FileName && (
                  <span className="text-xs text-gray-500 mt-1 cursor-pointer !text-blue-500 !underline" onClick={() => window.open(`/${note.FilePath}`, '_blank')}>{note.FileName}</span>
                )}
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onDelete(index)}
                  className="text-red-600 hover:text-red-800 cursor-pointer"
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
        projectId={initialData?.ProjectDetails?.ReferenceId || ''}
        onAddNote={handleAddNote}
      />
      
    </div>
  );
};

export default NotesForm;
