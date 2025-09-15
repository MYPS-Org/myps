import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { Button } from '../../../components/tailwindui/button';
import { roadsAtom, selectedItemAtom, type Road } from "../state/rbiaAtoms";

interface FutureRoadDialogProps {
  onClose: () => void;
}

const FutureRoadDialog: React.FC<FutureRoadDialogProps> = ({ onClose }) => {
  const [roads, setRoads] = useAtom(roadsAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  const [formData, setFormData] = useState<Road>({
    Id: 0,
    RoadId: "",
    Name: "",
    Classification: "",
    CreatedBy: '',
    CreatedDate: '',
    UpdatedBy: '',
    UpdatedDate: ''
  });

  useEffect(() => {
    if (selectedItem && 'RoadId' in selectedItem && 'Classification' in selectedItem) {
      setFormData(selectedItem as Road); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.RoadId.startsWith("FR")) {
      alert("Road ID must start with 'FR'");
      return;
    }

    if (!formData.RoadId || !formData.Name || formData.Classification ) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      if (selectedItem) {
        // Edit existing road
        setRoads(
          roads.map((road: Road) =>
            road.RoadId === (selectedItem as Road).RoadId ? formData : road
          )
        );
      } else {
        // Create new road
        setRoads([...roads, formData]);
      }
      handleClose();
    } catch (error) {
      console.error("Error saving road:", error);
      alert("Failed to save road. Please try again.");
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
      Name: "",
      Classification: "",
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
              {selectedItem ? "Edit Future Road" : "Add New Future Road"}
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
                Road ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.RoadId}
                onChange={(e) => handleChange('RoadId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter Road ID (must start with 'FR')"
              />
              <p className="text-xs text-gray-500 mt-1">
                Road ID must start with 'FR' (e.g., FR001, FR002)
              </p>
            </div>

            {/* Road Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Road Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.Name}
                onChange={(e) => handleChange('Name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter road name"
              />
            </div>

            {/* Classification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Road Classification <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.Classification}
                onChange={(e) => handleChange('Classification', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                required
              >
                <option value={0}>Select Classification</option>
                <option value={1}>Primary Road (Classification 1)</option>
                <option value={2}>Secondary Road (Classification 2)</option>
                <option value={3}>Tertiary Road (Classification 3)</option>
                <option value={4}>Local Road (Classification 4)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClose} color='zinc'>
                Cancel
              </Button>
              <Button type="submit" color='orange'>
                {selectedItem ? "Update Road" : "Create Road"}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FutureRoadDialog;
