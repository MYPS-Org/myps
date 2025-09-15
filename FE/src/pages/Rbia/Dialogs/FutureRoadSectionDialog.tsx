import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { Button } from '../../../components/tailwindui/button';
import { roadSectionsAtom, selectedItemAtom, roadsAtom, type RoadSection } from "../state/rbiaAtoms";

interface FutureRoadSectionDialogProps {
  onClose: () => void;
}

const FutureRoadSectionDialog: React.FC<FutureRoadSectionDialogProps> = ({ onClose }) => {
  const [futureRoadSections, setFutureRoadSections] = useAtom(roadSectionsAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  const [roads] = useAtom(roadsAtom);
  const [formData, setFormData] = useState<RoadSection>({
    Id: 0,
    RoadId: "",
    RoadSectionId: "",
    RoadLength: '',
    DEO: '',
    CreatedBy: '',
    CreatedDate: '',
    UpdatedBy: '',
    UpdatedDate: ''    
  });

  useEffect(() => {
    if (selectedItem && 'RoadSectionId' in selectedItem) {
      setFormData(selectedItem as RoadSection); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.RoadSectionId.startsWith("FS")) {
      alert("Section Road ID must start with 'FS'");
      return;
    }

    if (!formData.RoadId || !formData.RoadSectionId || formData.RoadLength || formData.DEO ) {
      alert("Please fill in all required fields with valid values");
      return;
    }

    try {
      if (selectedItem) {
        // Edit existing road section
        setFutureRoadSections(
          futureRoadSections.map((section: RoadSection) =>
            section.RoadSectionId === (selectedItem as RoadSection).RoadSectionId ? formData : section
          )
        );
      } else {
        // Create new road section
        setFutureRoadSections([...futureRoadSections, formData]);
      }
      handleClose();
    } catch (error) {
      console.error("Error saving road section:", error);
      alert("Failed to save road section. Please try again.");
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFormData({
      Id: 0,
      RoadId: "",
      RoadSectionId: "",
      RoadLength: "",
      DEO: "",
      CreatedBy: '',
      CreatedDate: '',
      UpdatedBy: '',
      UpdatedDate: ''
    });
  };

  return (
    <Dialog open={true} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {selectedItem ? "Edit Future Road Section" : "Add New Future Road Section"}
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Road ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Road ID <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.RoadId}
                onChange={(e) => handleChange('RoadId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                required
              >
                <option value="">Select Parent Road</option>
                {roads.map((road) => (
                  <option key={road.RoadId} value={road.RoadId}>
                    {road.RoadId} - {road.Name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the parent road for this section
              </p>
            </div>

            {/* Section Road ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Road ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.RoadSectionId}
                onChange={(e) => handleChange('RoadSectionId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter Section Road ID (must start with 'FR')"
              />
              <p className="text-xs text-gray-500 mt-1">
                Section Road ID must start with 'FR' (e.g., FR001-001, FR001-002)
              </p>
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Length (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={formData.RoadLength}
                onChange={(e) => handleChange('RoadLength', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter section length in kilometers"
              />
              <p className="text-xs text-gray-500 mt-1">
                Length must be greater than 0 km
              </p>
            </div>

            {/* Engineering District */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Engineering District <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.DEO}
                onChange={(e) => handleChange('DEO', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                required
              >
                <option value={0}>Select Engineering District</option>
                <option value={1}>District 1 - Northern Region</option>
                <option value={2}>District 2 - Central Region</option>
                <option value={3}>District 3 - Southern Region</option>
                <option value={4}>District 4 - Eastern Region</option>
                <option value={5}>District 5 - Western Region</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClose} color='zinc'>
                Cancel
              </Button>
              <Button type="submit" color='orange'>
                {selectedItem ? "Update Road Section" : "Create Road Section"}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FutureRoadSectionDialog;
