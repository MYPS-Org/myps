import React, { useState } from "react";
import type { ProjectSupportingDocs } from "../../../Project/Model.d";
import { Button } from "../../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../../components/tailwindui/table";
import { deleteDoc } from "../../../Project/Service";
import AddNoteDialog from "../../../Project/dialogs/AddNoteDialog";
import { useToast } from "../../../../components/toaster/ToasterContext";
import { getDisabledClass } from "../../../../utils/GlobalFunctions";

interface NotesFormProps {
  docs: ProjectSupportingDocs[];
  onAdd: (newNote: ProjectSupportingDocs) => void;
  onEdit: (index: number, updatedNote: ProjectSupportingDocs) => void;
  onDelete: (doc: ProjectSupportingDocs) => void;
  onFileChange?: (index: number, file: File) => void; // Optional if upload handled externally
  initialData?: any; // Optional initial data for dropdowns or other purposes
  dropDownOptions: any;
  disabled?: boolean;
}

const NotesForm: React.FC<NotesFormProps> = ({
  docs,
  onAdd,
  // onEdit,
  onDelete,
  // onFileChange,
  initialData,
  dropDownOptions,
  disabled = false
}) => {
  const { showToast } = useToast();
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);

  const handleAddNote = (docs: ProjectSupportingDocs) => {
    if (disabled) return;
    try {
      onAdd(docs);
      setIsAddNoteModalOpen(false);
      showToast({
        type: 'success',
        message: 'Document added successfully!'
      });
    } catch (error) {
      console.error('Error adding document:', error);
      showToast({
        type: 'error',
        message: 'Failed to add document.'
      });
    }
  };

  const handleDeleteDoc = async (doc: ProjectSupportingDocs) => {
    try {
      const deletedDoc = await deleteDoc(doc); // Pass as array
      if (deletedDoc) {
        onDelete(doc);
        showToast({
          type: 'success',
          message: 'Document deleted successfully!'
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast({
          type: 'error',
          message: 'Failed to delete document.'
      });
    }
  };

  const getFilePath = (filePath?: string) => {
    if (!filePath) return '#';
    return new URL(
      filePath,
      import.meta.env.VITE_API_BASE_URL
    )
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900"></h2>
        <Button color="blue" onClick={() => setIsAddNoteModalOpen(true)} disabled={disabled}>
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
          {docs.map((doc, index) => {
            if (doc.IsDeleted) return null;
            return (
            <TableRow key={`${doc.Id}-${index}-${doc.CreatedDate}`}>
              <TableCell className="w-lg text-center">
                {doc.FileName && (
                  <a href={getFilePath(doc.FilePath).toString()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 mt-1 underline cursor-pointer"
                  >
                    {doc.FileName}
                  </a>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span className="text-xs text-gray-500 mt-1">{doc.DocTypeName}</span>
              </TableCell>
              <TableCell className="text-center">
                  <span title={doc.Description} className="text-xs text-gray-500 mt-1">{doc.Description}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-xs text-gray-500 mt-1">{doc.CreatedDate ? new Date(doc.CreatedDate).toLocaleDateString() : '-'}</span>
              </TableCell>
              <TableCell className="flex justify-center space-x-2">
                <button
                  onClick={() => handleDeleteDoc(doc)}
                  className={`text-red-600 hover:text-red-800 cursor-pointer ${getDisabledClass(disabled)}`}
                  disabled={disabled}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Dialog */}
      <AddNoteDialog
        isOpen={isAddNoteModalOpen}
        onClose={() => setIsAddNoteModalOpen(false)}
        projectId={initialData?.ProjectDetails?.ProjectId || ''}
        onAddNote={handleAddNote}
        dropDownOptions={dropDownOptions}
        stageName={initialData?.ProjectDetails?.StageName || ''}
      />
    </div>
  );
};

export default NotesForm;
