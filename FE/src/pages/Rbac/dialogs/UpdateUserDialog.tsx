import React, { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon } from '@heroicons/react/16/solid';
import type { Users, vUserGroups } from '../Model.d';
import { fetchUserGroups, editUser, fetchUserData } from '../service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface UpdateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
  user: Users;
}

const UpdateUserDialog: React.FC<UpdateUserDialogProps> = ({ isOpen, onClose, onSubmit, user }) => {
  const { showToast } = useToast();
  const [availableGroups, setAvailableGroups] = useState<vUserGroups[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // The Employee ID whose PIS region/office are in the form, and the name PIS gave for it.
  const [pisEmployeeId, setPisEmployeeId] = useState<string | null>(null);
  const [pisName, setPisName] = useState('');
  
  const [formData, setFormData] = useState({
    id: user.Id || 0,
    employeeId: user.EmployeeId || '',
    name: user.Name || '',
    userId: user.UserId || '',
    email: user.Email || '',
    userGroupIds: user.UserGroupIds || [] as number[],
    regCode: user.RegCode || '',
    regName: user.RegName || '',
    plantillaOffice: user.PlantillaOffice || '',
    plantillaOfficeName: user.PlantillaOfficeName || '',
    isActive: user.IsActive ? 'active' : 'inactive',
  });

  // Update form data when user prop changes
  useEffect(() => {
    setFormData({
      id: user.Id,
      employeeId: user.EmployeeId || '',
      name: user.Name || '',
      userId: user.UserId || '',
      email: user.Email || '',
      userGroupIds: user.UserGroupIds || [] as number[],
      regCode: user.RegCode || '',
      regName: user.RegName || '',
      plantillaOffice: user.PlantillaOffice || '',
      plantillaOfficeName: user.PlantillaOfficeName || '',
      isActive: user.IsActive ? 'active' : 'inactive',
    });
    setPisEmployeeId(null);
    setPisName('');
  }, [user]);

  // Fetch available user groups when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableGroups();
    }
  }, [isOpen]);

  const handleSearch = async (value: string) => {
    const employeeId = value.trim();
    if (!employeeId) {
      setError('Enter an Employee ID to search.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // 2026-10-30, S04-TC028: ExcludeUserRowId lets the user's own Employee ID be looked up (the
      // search refused any Employee ID already in tUsers). Only the region and office come from PIS:
      // it used to overwrite the login (PIS network ID) and blank the email too.
      const userData = await fetchUserData({ EmployeeId: employeeId, ExcludeUserRowId: user.Id });
      if (userData) {
        setFormData(prev => ({
          ...prev,
          regCode: userData.Data.RegCode || '',
          regName: userData.Data.RegName || '',
          plantillaOffice: userData.Data.PlantillaOffice || '',
          plantillaOfficeName: userData.Data.PlantillaOfficeName || '',
        }));
        setPisEmployeeId(employeeId);
        setPisName(userData.Data.Name || '');
      } else {
        setError('Employee ID not found');
      }
    } catch (err: any) {
      setError(err.Message || 'Failed to fetch user data');
    } finally {
      setIsLoading(false);
    }
  };



  const fetchAvailableGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const response = await fetchUserGroups({
        page: 1,
        limit: 100, // Get all groups
        filters: {
          GroupName: ''
        }
      });
      
      if (response.Data && response.Data.lists) {
        setAvailableGroups(response.Data.lists);
      }
    } catch (error) {
      console.error('Error fetching user groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Handle form submission
  const handleSubmit = async(e: React.FormEvent) => {
    e.preventDefault();

    // Same check as Add User: a PIS region/office MYPS does not know comes back as "<code> (Not Exists)"
    // with no name, and must not be saved.
    if (pisEmployeeId !== null && !formData.regName) {
      showToast({ type: 'error', message: 'Region is required.' });
      return;
    }
    if (pisEmployeeId !== null && !formData.plantillaOfficeName) {
      showToast({ type: 'error', message: 'Plantilla Office is required.' });
      return;
    }
    
    const selectedGroupNames = availableGroups
      .filter(g => formData.userGroupIds.includes(g.Id))
      .map(g => g.GroupName || '');
    const submissionData = {
      Id: user.Id,
      UserGroupIds: formData.userGroupIds,
      UserGroupNames: selectedGroupNames,
      EmployeeId: formData.employeeId.trim(),
      UserId: formData.userId,
      Name: formData.name,
      Email: formData.email,
      RegCode: formData.regCode,
      RegName: formData.regName,
      PlantillaOffice: formData.plantillaOffice,
      PlantillaOfficeName: formData.plantillaOfficeName,
      IsActive: formData.isActive === 'active',
    };
    
    try {
      await editUser(submissionData);
      onSubmit(submissionData);
      showToast({ message: 'User updated successfully.', type: 'success' });
      setFormData({
        id: 0,
        employeeId: '',
        name: '',
        userId: '',
        email: '',
        userGroupIds: [],
        regCode: '',
        regName: '',
        plantillaOffice: '',
        plantillaOfficeName: '',
        isActive: 'active',
      });
      setError('');
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // A different Employee ID than the one searched: put the user's own region/office back, so another
  // employee's office is never saved under it.
  const handleEmployeeIdChange = (value: string) => {
    if (pisEmployeeId !== null && value.trim() !== pisEmployeeId) {
      setFormData(prev => ({
        ...prev,
        employeeId: value,
        regCode: user.RegCode || '',
        regName: user.RegName || '',
        plantillaOffice: user.PlantillaOffice || '',
        plantillaOfficeName: user.PlantillaOfficeName || '',
      }));
      setPisEmployeeId(null);
      setPisName('');
      return;
    }
    handleChange('employeeId', value);
  };

  const handleUserGroupChange = (groupId: number, isChecked: boolean) => {
    setFormData(prev => ({
      ...prev,
      userGroupIds: isChecked
        ? [...prev.userGroupIds, groupId]
        : prev.userGroupIds.filter(id => id !== groupId)
    }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-1 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Update User
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Id
                </label>
                <div className="flex items-center overflow-hidden border border-gray-300 rounded-md shadow-sm">
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeIdChange(e.target.value)}
                    className="w-full px-3 py-2"
                    placeholder="Enter employee ID"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={() => handleSearch(formData.employeeId)}
                    className="px-3 py-2.5 bg-gray-500 text-gray-400 hover:text-gray-700 focus:outline-none"
                  >
                    <MagnifyingGlassIcon className="text-center w-5 h-5 text-gray-400" />
                  </button>
                </div>
                {isLoading && (
                  <p className="text-sm text-blue-600 mt-1">Loading user data...</p>
                )}
                {!isLoading && pisEmployeeId !== null && pisName && (
                  <p className="text-xs text-gray-500 mt-1">Found in PIS: {pisName}</p>
                )}
                {!user.EmployeeId?.trim() && pisEmployeeId === null && (
                  <p className="text-xs text-gray-500 mt-1">
                    No Employee ID is on record. Enter it and click search to fill in the region and office from PIS; the login and email are kept.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  onChange={(e) => handleChange('userId', e.target.value)}
                  placeholder="Enter user ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Region
                </label>
                <input
                  type="text"
                  value={formData.regName}
                  placeholder="Enter region"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700"
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Enter email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plantilla Office
              </label>
              <input
                type="text"
                value={formData.plantillaOffice}
                onChange={(e) => handleChange('plantillaOffice', e.target.value)}
                placeholder="Enter department"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Group
              </label>
              {isLoadingGroups ? (
                <div className="text-sm text-gray-500">Loading user groups...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {availableGroups.length > 0 ? (
                    availableGroups.map((group) => (
                      <div key={group.Id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={formData.userGroupIds.includes(group.Id)}
                          onChange={(e) => handleUserGroupChange(group.Id, e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{group.GroupName}</span>
                        {group.Description && (
                          <span className="text-xs text-gray-500 ml-2">({group.Description})</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No user groups available</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={onClose} color="zinc">
                Cancel
              </Button>
              <Button type="submit" color="orange">
                Update User
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default UpdateUserDialog;
