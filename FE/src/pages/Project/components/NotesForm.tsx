import React, { useState } from "react";
import type { ProjectSupportingDocs } from "../Model.d";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import { deleteDoc } from "../Service";
import AddNoteDialog from "../dialogs/AddNoteDialog";
import { useToast } from "../../../components/toaster/ToasterContext";

interface NotesFormProps {
  docs: ProjectSupportingDocs[];
  onAdd: (newNote: ProjectSupportingDocs) => void;
  onEdit: (index: number, updatedNote: ProjectSupportingDocs) => void;
  onDelete: (doc: ProjectSupportingDocs) => void;
  onFileChange?: (index: number, file: File) => void; // Optional if upload handled externally
  initialData?: any; // Optional initial data for dropdowns or other purposes
  dropDownOptions: any;
}

const NotesForm: React.FC<NotesFormProps> = ({
  docs,
  onAdd,
  // onEdit,
  onDelete,
  // onFileChange,
  initialData,
  dropDownOptions
}) => {
  const { showToast } = useToast();
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);

  const handleAddNote = (docs: ProjectSupportingDocs) => {
    console.log('Adding new document to table:', docs);
    console.log('Current documents before adding:', docs);
    onAdd(docs);
    setIsAddNoteModalOpen(false);
  };

  const handleDeleteDoc = async (doc: ProjectSupportingDocs) => {
    console.log('Deleting document:', doc);
    try {
      const deletedDoc = await deleteDoc(doc); // Pass as array
      if (deletedDoc) {
        onDelete(doc);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast({
          type: 'error',
          message: 'Failed to delete document.'
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900"></h2>
        <Button color="blue" onClick={() => setIsAddNoteModalOpen(true)}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Document
        </Button>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader justify="center" className="w-lg">File</TableHeader>
            <TableHeader justify="center">Document Type</TableHeader>
            <TableHeader justify="center">Description</TableHeader>
            <TableHeader justify="center">Date</TableHeader>
            <TableHeader justify="center">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {docs.map((doc, index) => (
            <TableRow key={`${doc.Id}-${index}-${doc.CreatedDate}`}>
              <TableCell className="w-lg text-center">
                {doc.FileName && (
                  <span className="text-xs text-gray-500 mt-1 cursor-pointer !underline" onClick={() => window.open(`/${doc.FilePath}`, '_blank')}>{doc.FileName}</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-xs text-gray-500 mt-1">{doc.DocumentType}</span>
              </TableCell>
              <TableCell>
                  <span title={doc.Description} className="text-xs text-gray-500 mt-1">{doc.Description}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-gray-500 mt-1">{doc.CreatedDate ? new Date(doc.CreatedDate).toLocaleDateString() : '-'}</span>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => handleDeleteDoc(doc)}
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
        projectId={initialData?.ProjectDetails?.ProjectId || ''}
        onAddNote={handleAddNote}
        dropDownOptions={dropDownOptions}
      />
    </div>
  );
};

export default NotesForm;
