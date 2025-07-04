import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon } from '@heroicons/react/16/solid';
import { fetchUserData, fetchUserGroups } from '../service';
import type { UserGroups } from '../Model.d';

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
}

const AddUserDialog: React.FC<AddUserDialogProps> = ({ isOpen, onClose, onSubmit}) => {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    userId: '',
    email: '',
    userGroups: [] as string[],
    regCode: '',
    plantillaOffice: '',
    isActive: 'active',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<UserGroups[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [error, setError] = useState('');

  // Fetch available user groups when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableGroups();
    }
  }, [isOpen]);

  const fetchAvailableGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const response = await fetchUserGroups({
        page: 1,
        limit: 100, // Fetch all groups
        filters: {
          GroupName: ''
        }
      })
      if (response.Data && response.Data.lists) {
        setAvailableGroups(response.Data.lists);
      }
    }
    catch (error: any) {
      console.error('Error fetching user groups:', error);
    }
    finally{
      setIsLoadingGroups(false);
    }``
  };

  const handleSearch = async (value: string) => {
    setIsLoading(true);
    setError('');

    try {
      const userData = await fetchUserData({ EmployeeId: value });
      if (userData) {
        console.log('User data fetched:', userData);
        setFormData(prev => ({
          ...prev,
          name: userData.Data.Name || '',
          userId: userData.Data.UserId || '',
          email: userData.Data.Email || '',
          plantillaOffice: userData.Data.PlantillaOffice || ''
        }));
        setIsDataLoaded(true);
      } else {
        setError('Employee ID not found');
        setIsDataLoaded(false);
      }
    } catch (error: any) {

      setError(error.Message || 'Failed to fetch user data');
      setIsDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDataLoaded) {
      setError('Please enter a valid Employee ID first');
      return;
    }
    onSubmit(formData);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: '',
      userId: '',
      email: '',
      userGroups: [],
      regCode: '',
      plantillaOffice: '',
      isActive: 'active',
    });
    setIsDataLoaded(false);
    setError('');
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUserGroupChange = (group: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      userGroup: checked 
        ? [...prev.userGroups, group]
        : prev.userGroups.filter(g => g !== group)
    }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add New User
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error message */}
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
                <div className='flex items-center overflow-hidden border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => handleChange('employeeId', e.target.value)}
                    className="w-full px-3 py-2"
                    placeholder='Enter employee ID'
                    required
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
                  className={"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700" 
                    + (formData.userId ? '' : ' bg-gray-100')}
                  readOnly={!isDataLoaded || isLoading}
                  required
                />
              </div>
            </div>

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
                disabled={true}
                required
              />
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
                className={"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700"
                + (!isDataLoaded || isLoading ? ' bg-gray-100' : '')}
                disabled={!isDataLoaded || isLoading}
                required
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700"
                disabled={true}
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
                          checked={formData.userGroups.includes(group.GroupName || '')}
                          onChange={(e) => handleUserGroupChange(group.GroupName || '', e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          disabled={!isDataLoaded}
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
                disabled={!isDataLoaded}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={() => { resetForm(); onClose(); }} color="zinc">
                Cancel
              </Button>
              <Button 
                type="submit" 
                color="orange"
                disabled={!isDataLoaded || isLoading}
              >
                {isLoading ? 'Loading...' : 'Add User'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddUserDialog;
