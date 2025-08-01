// import React, { useEffect } from 'react';
import { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ProgramEnums, ProgramModel } from '../Model';
import { addProgram } from '../Service'; // Adjust the import path as necessary
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { useNavigate } from 'react-router-dom';

interface AddProgramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (program: ProgramModel) => void;
  programEnums?: {
    Statuses: ProgramEnums[];
    Stages: ProgramEnums[];
    Types: ProgramEnums[];
    Groups: ProgramEnums[];
  };
}

const AddProgramDialog: React.FC<AddProgramDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  programEnums, }) => {
  const navigate = useNavigate();
  const Status = programEnums?.Statuses || [];
  const Stage = programEnums?.Stages || [];
  const Type = programEnums?.Types || [];
  const Group = programEnums?.Groups || [];

  const [formData, setFormData] = useState({
    Id: 0,
    Stage: 0,
    Status: 0,
    Type: 0,
    UserGroup: 0,
    Name: '',
    YearStart: new Date().getFullYear(),
    YearEnd: new Date().getFullYear() + 6,
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await addProgram(formData);
      onSubmit(formData); // Call the onSubmit prop with the form data
      handleReset(); // Reset the form data
      navigate(`programdetails/${response.Data.Id}`); // Navigate to the program details page
    } catch (error) {
      console.error('Error submitting program:', error);
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
      Id: 0,
      Stage: 0,
      Status: 0,
      Type: 0,
      UserGroup: 0,
      Name: '',
      YearStart: new Date().getFullYear(),
      YearEnd: new Date().getFullYear() + 6,
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
              Add New Group
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Program Name</label>
            <input
              type="text"
              value={formData.Name}
              onChange={(e) => handleChange('Name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Year</label>
              <input
                type="number"
                value={formData.YearStart}
                onChange={(e) => handleChange('YearStart', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">End Year</label>
              <input
                type="number"
                value={formData.YearEnd}
                onChange={(e) => handleChange('YearEnd', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
              />
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User Group</label>
              <select
                value={formData.UserGroup}
                onChange={(e) => handleChange('UserGroup', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option className="text-gray-500" value="">
                  Select User Group
                </option>
                {Group.map((group) => (
                  <option key={group.Id} value={group.Id}>
                    {group.GroupName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Stage</label>
              <select
                value={formData.Stage}
                onChange={(e) => handleChange('Stage', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option className="text-gray-500" value="">
                  Select Stage
                </option>
                {Stage.map((stage) => (
                  <option key={stage.Id} value={stage.Enum}>
                    {stage.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Status</label>
              <select
                value={formData.Status}
                onChange={(e) => handleChange('Status', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option className="text-gray-500" value="">
                  Select Status
                </option>
                {Status.map((status) => (
                  <option key={status.Id} value={status.Enum}>
                    {status.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Type</label>
              <select
                value={formData.Type}
                onChange={(e) => handleChange('Type', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option className="text-gray-500" value="">
                  Select Type
                </option>
                {Type.map((type) => (
                  <option key={type.Id} value={type.Enum}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
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

export default AddProgramDialog;
