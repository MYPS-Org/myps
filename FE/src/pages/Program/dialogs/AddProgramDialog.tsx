// import React, { useEffect } from 'react';
import { useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ProgramEnums, ProgramModel, TableEnum } from '../Model';
import { addProgram } from '../Service'; // Adjust the import path as necessary
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/toaster/ToasterContext';
import CheckboxList from '../../../components/ui/CheckboxList';

interface AddProgramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (program: ProgramModel) => void;
  programEnums?: {
    // Statuses: ProgramEnums[];
    Stages: TableEnum[];
    Types: TableEnum[];
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    Id: 0,
    Stage: 0,
    Status: 1,
    Type: 0,
    UserGroup: [] as number[], // Array to store selected user group IDs
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

    const validationErrors: Record<string, string> = {};
    if (!formData.Type || formData.Type === 0) {
      validationErrors.Type = 'Program Type is required.';
    }
    if (formData.Type !== 3 && (!formData.Stage || formData.Stage === 0)) {
      validationErrors.Stage = 'Program Stage is required.';
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Object.values(validationErrors).forEach(msg => showToast({ type: 'error', message: msg }));
      return;
    }
    setErrors({});

    const fullName = formData.AddedName
      ? `${formData.Name} ${formData.AddedName}`
      : formData.Name;
    if (fullName.length > 100) {
      showToast({
        type: 'error',
        message: 'Sub Name cannot exceed 100 characters.',
      });
      return;
    }
    try {
      const payload = { ...formData, Name: fullName };
      const response = await addProgram(payload);
      onSubmit(formData);
      const StageName = Stage.find(stage => stage.NameId === formData.Stage)?.Name || '';
      if (response && response.Data && response.Data.Id) {
        showToast({
          type: 'success',
          message: 'Program added successfully!',
        });
        navigate(`programdetails/${response.Data.Id}:${StageName}`);
      }
      handleReset();
    } catch {
      // httpClient interceptor already shows the API error toast
    }
  };

  const handleChange = (field: string, value: any) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Auto-generate name when Stage or YearStart changes
      if (field === 'Stage' || field === 'YearStart' || field === 'Type') {
        // Trust Fund type auto-selects the TF stage; leaving Trust Fund resets it
        if (field === 'Type') {
          if (value === 3) {
            newFormData.Stage = 12; // TF
          } else if (prev.Type === 3) {
            newFormData.Stage = 0;
          }
        }

        const selectedStage = Stage.find(stage => stage.NameId === (field === 'Stage' ? value : newFormData.Stage));
        const stageName = selectedStage ? selectedStage.Name : '';
        const yearStart = field === 'YearStart' ? value : newFormData.YearStart;
        newFormData.Name = stageName + ' ' + yearStart;
        // Auto-skip logic: NEP through GAA-R (NameId 2-7), plus TF-R (NameId 13).
        // RBP, RDIP, PIP, and TF are not auto-skipped.
        if (
          field === 'Stage' &&
          selectedStage &&
          ((selectedStage.NameId >= 2 && selectedStage.NameId <= 7) || selectedStage.NameId === 13)
        ) {
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

  const handleUserGroupToggle = (userGroupId: string) => {
    const numericId = parseInt(userGroupId);
    setFormData(prev => ({
      ...prev,
      UserGroup: prev.UserGroup.includes(numericId)
        ? prev.UserGroup.filter(id => id !== numericId)
        : [...prev.UserGroup, numericId]
    }));
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setErrors({});
    setFormData({
      Id: 0,
      Stage: 0,
      Status: 0,
      Type: 0,
      UserGroup: [],
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
    <Dialog open={isOpen} onClose={handleClose} className="fixed z-10 inset-0 overflow-y-auto">
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
              onClick={handleClose}
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
                    placeholder="Add Sub Name"
                    required
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Year</label>
              <input
                type="number"
                value={formData.YearStart}
                min={1990}
                max={2100}
                onChange={(e) => handleChange('YearStart', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${errors.Type ? 'text-red-500' : 'text-gray-700'}`}>
                Program Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.Type}
                onChange={(e) => handleChange('Type', Number(e.target.value))}
                className={`w-full px-3 py-2 border ${errors.Type ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900`}
              >
                <option className="text-gray-500" value="">
                  Select Type
                </option>
                {Type.map((type) => (
                  <option key={type.Id} value={type.NameId}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${errors.Stage ? 'text-red-500' : 'text-gray-700'}`}>
                Program Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.Stage}
                onChange={(e) => handleChange('Stage', Number(e.target.value))}
                className={`w-full px-3 py-2 border ${errors.Stage ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 ${formData.Type == 3 ? '!bg-gray-50 cursor-not-allowed' : ''}`}
                disabled={formData.Type == 3}
              >
                <option className="text-gray-500" value="">
                  Select Stage
                </option>
                {Stage.filter((stage) => {
                  // TF/TF-R are not manually selectable; TF is auto-assigned when Type is Trust Fund
                  if (stage.NameId === 12) return formData.Type === 3;
                  if (stage.NameId === 13) return false;
                  return true;
                }).map((stage) => (
                  <option key={stage.Id} value={stage.NameId}>
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

          {/* User Group Multiple Select */}
          <CheckboxList
            title="User Groups"
            items={(Group || []).map(group => ({
              id: group.Id.toString(),
              name: group.GroupName ?? '',
            }))}
            selectedIds={formData.UserGroup.map(id => id.toString())}
            onToggle={handleUserGroupToggle}
            onSelectAll={() => {
              const allGroupIds = Group.map(g => g.Id);
              setFormData(prev => ({ ...prev, UserGroup: allGroupIds }));
            }}
            onClearAll={() => setFormData(prev => ({ ...prev, UserGroup: [] }))}
            idKey="id"
            nameKey="name"
            searchPlaceholder="Search user groups..."
            emptyMessage="No user groups available"
          />

          {/* Data Security Multiple Select */}
          <CheckboxList
            title="Data Security Access"
            items={(DataSecurity || []).map(item => ({
              id: item.ParticipantId ?? '',
              name: item.Name ?? '',
              groupType: item.OrgType === 'CO' ? 'CO' :
                         item.OrgType === 'B' ? 'CO' :
                         item.OrgType === 'R' ? 'Regional Offices' :
                         item.OrgType === 'PMO' ? 'Project Management Offices' :
                         item.OrgType || 'Other'
            }))}
            selectedIds={formData.DataSecurityGroup}
            onToggle={handleDataSecurityToggle}
            onSelectAll={() => {
              const allDataSecurityIds = DataSecurity.map(item => item.ParticipantId ?? '');
              setFormData(prev => ({ ...prev, DataSecurityGroup: allDataSecurityIds }));
            }}
            onClearAll={() => setFormData(prev => ({ ...prev, DataSecurityGroup: [] }))}
            groupBy="groupType"
            idKey="id"
            nameKey="name"
            searchPlaceholder="Search organizations..."
            emptyMessage="No data security options available"
          />
            

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
