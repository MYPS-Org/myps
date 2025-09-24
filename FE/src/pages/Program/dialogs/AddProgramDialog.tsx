// import React, { useEffect } from 'react';
import { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ProgramEnums, ProgramModel } from '../Model';
import { addProgram } from '../Service'; // Adjust the import path as necessary
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/toaster/ToasterContext';

interface AddProgramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (program: ProgramModel) => void;
  programEnums?: {
    // Statuses: ProgramEnums[];
    Stages: ProgramEnums[];
    Types: ProgramEnums[];
    Groups: ProgramEnums[];
    DataSecurity: ProgramEnums[];
  };
}

const AddProgramDialog: React.FC<AddProgramDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  programEnums, }) => {
  const navigate = useNavigate();
  // const Status = programEnums?.Statuses || [];
  const Stage = programEnums?.Stages || [];
  const Type = programEnums?.Types || [];
  const Group = programEnums?.Groups || [];
  const DataSecurity = programEnums?.DataSecurity || [];
  const [skipped, setSkipped] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();
  
  // Group data security by OrgType
  const groupedDataSecurity = DataSecurity.reduce((acc, item) => {
    const orgType = item.OrgType || 'Other';
    if (!acc[orgType]) {
      acc[orgType] = [];
    }
    acc[orgType].push(item);
    return acc;
  }, {} as {[key: string]: typeof DataSecurity});

  const [formData, setFormData] = useState({
    Id: 0,
    Stage: 0,
    Status: 1,
    Type: 0,
    UserGroup: 0,
    Name: '',
    AddedName: '',
    YearStart: new Date().getFullYear() + 1,
    YearEnd: new Date().getFullYear(),
    SkipReason: '',
    IsSkipped: false,
    DataSecurityGroup: [] as string[], // Array to store selected data security IDs
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData, 
        Name: formData.AddedName 
          ? `${formData.Name} - ${formData.AddedName}` 
          : formData.Name 
      }
      const response = await addProgram(payload);
      onSubmit(formData); // Call the onSubmit prop with the form data
      const StageName = Stage.find(stage => stage.Enum === formData.Stage)?.Name || '';
      if (response && response.Data && response.Data.Id) {
        showToast({
          type: 'success',
          message: 'Program added successfully!',
        });
        navigate(`programdetails/${response.Data.Id}:${StageName}`); // Navigate to the program details page
      }
      handleReset(); // Reset the form data
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to add program. Please try again.',
      });
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Auto-generate name when Stage or YearStart changes
      if (field === 'Stage' || field === 'YearStart') {
        const selectedStage = Stage.find(stage => stage.Enum === (field === 'Stage' ? value : newFormData.Stage));
        const stageName = selectedStage ? selectedStage.Name : '';
        const yearStart = field === 'YearStart' ? value : newFormData.YearStart;
        newFormData.Name = stageName + ' ' + yearStart;
        // Auto-skip logic for stages 5-11
        if (field === 'Stage' && selectedStage && selectedStage.Enum >= 5 && selectedStage.Enum <= 11) {
          newFormData.IsSkipped = true;
          setSkipped(true);
        } else if (field === 'Stage') {
          newFormData.IsSkipped = false;
          setSkipped(false);
          newFormData.SkipReason = ''; // Clear reason when not skipping
        }
      }

      return newFormData;
    });
  };

  const handleDataSecurityToggle = (dataSecurityId: string) => {
    setFormData(prev => ({
      ...prev,
      DataSecurityGroup: prev.DataSecurityGroup.includes(dataSecurityId)
        ? prev.DataSecurityGroup.filter(id => id !== dataSecurityId)
        : [...prev.DataSecurityGroup, dataSecurityId]
    }));
  };

  // Helper function to check if all items in a group are selected
  const isGroupSelected = (orgType: string): boolean => {
    const groupItems = groupedDataSecurity[orgType] || [];
    return groupItems.length > 0 && groupItems.every(item => 
      formData.DataSecurityGroup.includes(item.ParticipantId ?? '')
    );
  };

  // Helper function to check if some items in a group are selected
  const isGroupPartiallySelected = (orgType: string): boolean => {
    const groupItems = groupedDataSecurity[orgType] || [];
    return groupItems.some(item => 
      formData.DataSecurityGroup.includes(item.ParticipantId ?? '')
    ) && !isGroupSelected(orgType);
  };

  // Helper function to toggle all items in a group
  const handleGroupToggle = (orgType: string) => {
    const groupItems = groupedDataSecurity[orgType] || [];
    const groupItemIds = groupItems.map(item => item.ParticipantId ?? '');
    
    if (isGroupSelected(orgType)) {
      // Remove all group items
      setFormData(prev => ({
        ...prev,
        DataSecurityGroup: prev.DataSecurityGroup.filter(id => !groupItemIds.includes(id))
      }));
    } else {
      // Add all group items
      setFormData(prev => ({
        ...prev,
        DataSecurityGroup: [...new Set([...prev.DataSecurityGroup, ...groupItemIds])]
      }));
    }
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
      AddedName: '',
      YearStart: new Date().getFullYear(),
      YearEnd: new Date().getFullYear() + 6,
      SkipReason: '',
      IsSkipped: false,
      DataSecurityGroup: [],
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
              Add New Program
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
          <div className="w-full">
            <div className='flex flex-row mb-4'>
              <div className='w-1/3'>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program Name</label>
                <div className="items-center space-x-3">
                  <input
                    type="text"
                    value={formData.Name}
                    onChange={(e) => handleChange('Name', e.target.value)}
                    className='w-full px-3 py-2 border rounded-l-md shadow-sm focus:outline-none focus:ring-2 bg-gray-200'
                    required
                    disabled
                    placeholder="Auto-generated Name"
                  />
                </div>
              </div>
              <div className='w-2/3'>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Name</label>
                <div className="items-center space-x-3">
                  <input
                    type="text"
                    value={formData.AddedName}
                    onChange={(e) => handleChange('AddedName', e.target.value)}
                    className='w-full px-3 py-2 border-y border-r rounded-r-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder="Add Sub Name Not required"
                  />
                </div>
              </div>
            </div>
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
          {skipped && (
            <div className="grid grid-cols-2 gap-5 mb-8 bg-red-100 p-3 border border-red-200 rounded-lg">
                <div className="content-center">
                  <p className="text-sm text-red-600">
                    Note: Skipping this step may affect your program's setup.
                  </p>
                </div>
                <div className="content-center">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                  <input
                    type="text"
                    value={formData.SkipReason}
                    onChange={(e) => handleChange('SkipReason', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                    required
                    placeholder='Reason'
                  />
                </div>
            </div>
          )}

          {/* Data Security Multiple Select */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Data Security Access
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const allDataSecurityIds = DataSecurity.map(item => item.Id);
                    setFormData(prev => ({ ...prev, DataSecurityIds: allDataSecurityIds }));
                  }}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, DataSecurityIds: [] }))}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search organizations..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
              {Object.keys(groupedDataSecurity).map((orgType) => {
                const groupItems = groupedDataSecurity[orgType].filter(item =>
                  item.OrgName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.ParticipantId?.toLowerCase().includes(searchTerm.toLowerCase())
                );
                
                if (groupItems.length === 0) return null;
                
                return (
                  <div key={orgType} className="mb-6">
                    <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200">
                      <input
                        type="checkbox"
                        checked={isGroupSelected(orgType)}
                        ref={(input) => {
                          if (input) input.indeterminate = isGroupPartiallySelected(orgType);
                        }}
                        onChange={() => handleGroupToggle(orgType)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <h4 className="font-semibold text-gray-800">
                        {orgType === 'C' ? 'Central Office' : 
                         orgType === 'R' ? 'Regional Offices' : 
                         orgType === 'B' ? 'Bureaus' :
                         orgType === 'PMO' ? 'Project Management Offices' : 
                         orgType}
                      </h4>
                      <span className="text-xs text-gray-500">
                        ({groupItems.length} organizations)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 ml-6">
                      {groupItems.map((item) => (
                        <label key={item.Id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.DataSecurityGroup.includes(item.ParticipantId ?? '')}
                            onChange={() => handleDataSecurityToggle(item.ParticipantId ?? '')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-700 font-medium">
                              {item.OrgName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {item.ParticipantId}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {DataSecurity.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No data security options available
                </div>
              )}
              {Object.keys(groupedDataSecurity).every(orgType => 
                groupedDataSecurity[orgType].filter(item =>
                  item.OrgName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.ParticipantId?.toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0
              ) && searchTerm && (
                <div className="text-center py-4 text-gray-500">
                  No organizations found matching "{searchTerm}"
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Selected: {formData.DataSecurityGroup.length} organizations
            </p>
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
