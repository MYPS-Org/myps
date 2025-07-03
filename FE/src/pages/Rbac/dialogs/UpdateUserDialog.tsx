import React, { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Users, UserGroups } from '../Model.d';
import { fetchUserGroups, editUser } from '../service';

interface UpdateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
  user: Users;
}

const UpdateUserDialog: React.FC<UpdateUserDialogProps> = ({ isOpen, onClose, onSubmit, user }) => {
  const [availableGroups, setAvailableGroups] = useState<UserGroups[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  
  const [formData, setFormData] = useState({
    id: user.Id || 0,
    employeeId: user.EmployeeId || '',
    name: user.Name || '',
    userId: user.UserId || '',
    email: user.Email || '',
    userGroups: user.UserGroups ? user.UserGroups.split(',').map(g => g.trim()) : [],
    regCode: user.RegCode || '',
    plantillaOffice: user.PlantillaOffice || '',
    isActive: user.IsActive ? 'active' : 'inactive',
  });

  // Update form data when user prop changes
  useEffect(() => {
    setFormData({
      id: user.Id || 0,
      employeeId: user.EmployeeId || '',
      name: user.Name || '',
      userId: user.UserId || '',
      email: user.Email || '',
      userGroups: user.UserGroups ? user.UserGroups.split(',').map(g => g.trim()) : [],
      regCode: user.RegCode || '',
      plantillaOffice: user.PlantillaOffice || '',
      isActive: user.IsActive ? 'active' : 'inactive',
    });
  }, [user]);

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
    
    // Convert userGroups array back to comma-separated string
    const submissionData = {
      Id: user.Id,
      UserGroups: formData.userGroups.join(','),
      EmployeeId: formData.employeeId,
      UserId: formData.userId,
      Name: formData.name,
      Email: formData.email,
      RegCode: formData.regCode,
      PlantillaOffice: formData.plantillaOffice,
      IsActive: formData.isActive === 'active',
    };
    
    setFormData({
      id: 0,
      employeeId: '',
      name: '',
      userId: '',
      email: '',
      userGroups: [],
      regCode: '',
      plantillaOffice: '',
      isActive: 'active',
    });
    try {
      await editUser(submissionData);
      onSubmit(submissionData);
      setFormData({
        id: 0,
        employeeId: '',
        name: '',
        userId: '',
        email: '',
        userGroups: [],
        regCode: '',
        plantillaOffice: '',
        isActive: '',
      });
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUserGroupChange = (groupName: string, isChecked: boolean) => {
    setFormData(prev => ({
      ...prev,
      userGroups: isChecked
        ? [...prev.userGroups, groupName]
        : prev.userGroups.filter(group => group !== groupName)
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Id
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                  placeholder="Enter employee ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
