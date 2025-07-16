import { useState } from "react";
import type { ProjectNote } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";

interface NotesFormProps {
  initialNotes?: ProjectNote[];
  onSubmit: (notes: ProjectNote[]) => void;
}

const NotesForm: React.FC<NotesFormProps> = ({ initialNotes = [], onSubmit }) => {
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);

  const handleAddNote = () => {
    setNotes([...notes, { id: Date.now(), content: "", createdAt: new Date() }]);
  };

  const handleChange = (index: number, value: string) => {
    const updatedNotes = [...notes];
    updatedNotes[index].content = value;
    setNotes(updatedNotes);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(notes);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            <Button color="blue">
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Notes
            </Button>
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Actions</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Created Date</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notes.map(note => (
                <TableRow key={note.Id}>
                  <TableCell>
                    <div className="flex space-x-1">
                      <button className="text-blue-600 hover:text-blue-800">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{note.Description}</TableCell>
                  <TableCell>{note.CreatedDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

  );
};

export default NotesForm;