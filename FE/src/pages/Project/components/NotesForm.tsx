import React from "react";
import type { ProjectNote } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";

interface NotesFormProps {
  notes: ProjectNote[];
  onAdd: () => void;
  onEdit: (index: number, updatedNote: ProjectNote) => void;
  onDelete: (index: number) => void;
}

const NotesForm: React.FC<NotesFormProps> = ({ notes, onAdd, onEdit, onDelete }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Project Notes</h2>
            <Button color="blue" onClick={onAdd}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Note
            </Button>
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Description</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notes.map((note, index) => (
                <TableRow key={note.Id}>
                  <TableCell>
                    <textarea
                      value={note.Description}
                      onChange={(e) => onEdit(index, { ...note, Description: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      placeholder="Enter note description"
                      rows={2}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="date"
                      value={note.CreatedDate}
                      onChange={(e) => onEdit(index, { ...note, CreatedDate: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
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
        </div>
  );
};

export default NotesForm;