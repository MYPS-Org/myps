import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, DocumentArrowUpIcon, DocumentIcon } from '@heroicons/react/24/outline';
import type { AddNotes, ProjectSupportingDocs, DropdownSupportingDocs } from '../Model.d';
import { addDoc } from '../Service';
import { toDateInputValue } from '../../../utils/GlobalFunctions';
import { useToast } from '../../../components/toaster/ToasterContext';

interface AddNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onAddNote: (note: ProjectSupportingDocs) => void;
  dropDownOptions: DropdownSupportingDocs[];
  stageName: string;
}

const AddNoteDialog: React.FC<AddNoteDialogProps> = ({ 
  isOpen, 
  onClose, 
  projectId, 
  onAddNote,
  stageName,
  dropDownOptions = [] }) => {
  const [formData, setFormData] = useState<AddNotes>({
    StageName: stageName || '',
    ProjectId: projectId,
    DocumentType: '',
    DocTypeName: '', 
    Description: '',
    File: {
      Name: '',
      Extension: '',
      ContentType: '',
      DataUrl: ''
  } // Ensures File is nullable
  });

  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        StageName: stageName || '',
        ProjectId: projectId,
        DocumentType: '',
        DocTypeName: '',
        Description: '',
        File: {
          Name: '',
          Extension: '',
          ContentType: '',
          DataUrl: ''
        }
      });
    }
  }, [isOpen, projectId]);


  const handleChange = (field: keyof AddNotes, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if file is PDF
      if (file.type !== 'application/pdf') {
        showToast({ type: 'error', message: 'Please select a PDF file only.' });
        e.target.value = ''; // Clear the input
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          File: {
            Name: file.name,
            Extension: file.name.split('.').pop() || '',
            ContentType: file.type,
            DataUrl: reader.result as string,
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.File?.DataUrl) {
      showToast({ type: 'error', message: 'Please upload a PDF file.' });
      return;
    }

    setIsLoading(true);

    try {
        console.log('Submitting Document with data:', formData);
        const response = await addDoc(formData);
        console.log('Add document response:', response);

        if (response?.Data) {
            // 2026-09-11 fix: previously fabricated this row entirely from client-only data --
            // FilePath was set to formData.File.DataUrl (the base64 preview URL), which worked
            // as a link target by accident (data: is a valid absolute URI) but opened the raw
            // upload blob instead of the real server file until a refresh replaced it with real
            // data. UploadSupportingDocs now returns the actual persisted row -- use that instead
            // of guessing, so the just-uploaded doc works immediately, not just after refresh.
            const doc = response.Data;
            const newDoc: ProjectSupportingDocs = {
            Id: doc.Id,
            ProjectId: projectId,
            DocumentType: doc.DocTypeName || formData.DocTypeName || formData.DocumentType,
            Code: doc.DocTypeFK || '',
            Name: doc.DocTypeName || '',
            DocTypeFK: doc.DocTypeFK || '',
            DocTypeName: doc.DocTypeName || '',
            Description: doc.Description,
            FileName: doc.FileName,
            FileExtension: doc.FileExtension,
            FilePath: doc.FilePath,
            CreatedBy: doc.CreatedBy,
            CreatedDate: doc.CreatedDate || toDateInputValue(new Date()),
            };

            console.log('Creating new document object:', newDoc);

            // Reset form data
            setFormData({
              StageName: '',
              ProjectId: projectId,
              DocumentType: '',
              DocTypeName: '',
              Description: '',
              File: {
                Name: '',
                Extension: '',
                ContentType: '',
                DataUrl: '',
              },
            });
            
            // Call parent handlers
            console.log('Calling onAddNote with:', newDoc);
            onAddNote(newDoc);
            console.log('Calling onClose');
            onClose();
        } else {
            console.log('Unexpected response:', response);
        }

    } catch (error) {
        console.error('Error adding note:', error);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add Documents
            </DialogTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <select
              value={formData.DocumentType}
              onChange={e => {
                const selectedValue = e.target.value;
                const selectedOption = dropDownOptions?.find(
                  (option: DropdownSupportingDocs) => option.Code + ':' + option.Name === selectedValue
                );
                setFormData(prev => ({
                  ...prev,
                  DocumentType: selectedValue,
                  DocTypeName: selectedOption?.Name || '',
                }));
              }}
              className="w-full border rounded p-2">
                <option value="" disabled>Select Document Type</option>
                {dropDownOptions?.map((option: DropdownSupportingDocs) => (
                  <option key={option.Id} value={option.Code + ':' + option.Name}>
                    {option.Name}
                  </option>
                ))}
            </select>
            <textarea
              value={formData.Description}
              onChange={e => handleChange('Description', e.target.value)}
              placeholder="Note description"
              className="w-full border rounded p-2"
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Upload PDF File
              </label>
              <div className="relative">
                <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {formData.File?.Name ? (
                      <>
                        <DocumentIcon className="w-8 h-8 mb-2 text-green-500" />
                        <p className="text-sm text-gray-700 font-medium">{formData.File.Name}</p>
                        <p className="text-xs text-gray-500">PDF file selected</p>
                      </>
                    ) : (
                      <>
                        <DocumentArrowUpIcon className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF files only</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={e => handleFileChange(e)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="blue" disabled={isLoading}>
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
