// import React, { useEffect } from 'react';
import { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
// import type { ProgramEnums, ProgramModel } from '../Model';
// import { addProgram } from '../Service'; // Adjust the import path as necessary
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { useNavigate } from 'react-router-dom';
import type { AddProjectGroupModel, UserGroups } from '../Model';
import { addProjectGroup } from '../Service';
import { formValidation, type FormValidationError } from '../../../utils/FormValidation';
import { projectGroupFormRules } from '../rules/projectGroupRules';

interface AddProjectGroupDialogProps {
  isOpen: boolean;
  dropdownData?: any;
  onClose: () => void;
  onSubmit: (projectGroup: AddProjectGroupModel) => void;
}

const AddProjectGroupDialog: React.FC<AddProjectGroupDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  dropdownData
}) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    Name: '',
    Description: '',
    UserGroup: 0,
  });
  const [errors, setErrors] = useState<FormValidationError<AddProjectGroupModel>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = formValidation<AddProjectGroupModel>(formData, projectGroupFormRules)
    setErrors(validationErrors);

    // If there are validation errors, don't proceed with save
    if (Object.keys(validationErrors).length > 0) {
    console.log('Validation errors found:', validationErrors);
    return;
    }

    try {
        const response = await addProjectGroup(formData);
        if (response) {
            navigate(`/project-groups/${response.Data.NewGroupId}`); // Redirect to the project groups page after successful submission
            onSubmit(formData); // Call the onSubmit prop with the form data
            handleClose(); // Reset the form after submission
        }
    } catch (error) {
      console.error('Error submitting project group:', error);
      alert('Failed to add project group. Please try again.');
      handleClose(); // Reset the form even if submission fails
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFormData({
        Name: '',
        Description: '',
        UserGroup: 0,
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">

      <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add New Project Group
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 "
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Form fields go here */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${errors.Name ? 'text-red-500' : 'text-gray-700'} mb-2`}>Project Group Name</label>
            <input
              type="text"
              value={formData.Name}
              onChange={(e) => handleChange('Name', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 ${errors.Name ? 'border-red-500' : ''}`}
            //   required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="description" className={`block text-sm font-medium ${errors.Description ? 'text-red-500' : 'text-gray-700'} mb-2`}>Description</label>
            <textarea
              id="description"
              value={formData.Description}
              onChange={(e) => handleChange('Description', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 ${errors.Description ? 'border-red-500' : ''}`}
              rows={3}
            //   required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="userGroup" className={`block text-sm font-medium ${errors.UserGroup ? 'text-red-500' : 'text-gray-700'} mb-2`}>User Group</label>
            <select
              id="userGroup"
              value={formData.UserGroup}
              onChange={(e) => handleChange('UserGroup', Number(e.target.value))}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 ${errors.UserGroup ? 'border-red-500' : ''}`}
            //   required
            >
              <option className="text-gray-500" value="">
                Select User Group
              </option>
              {dropdownData.UserGroups.map((group: UserGroups) => (
                <option key={group.Id} value={group.Id}>
                  {group.GroupName}
                </option>
              ))}
            </select>
          </div>
            

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" onClick={handleClose} color='zinc'>
              Cancel
            </Button>
            <Button type="submit" color='orange'>
              Submit
            </Button>
          </div>
        </form>
      </DialogPanel>
      </div>
      {/* Close button */}
    </Dialog>
  );
};

export default AddProjectGroupDialog;
