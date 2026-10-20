import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { Button } from '../../../components/tailwindui/button';
import { roadsAtom, roadClassificationsAtom, selectedItemAtom, type Road } from "../state/rbiaAtoms";
import { addFutureRoad, editFutureRoad } from "../Service";
import { useToast } from '../../../components/toaster/ToasterContext';

interface FutureRoadDialogProps {
  onClose: () => void;
}

const FutureRoadDialog: React.FC<FutureRoadDialogProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [roads, setRoads] = useAtom(roadsAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  // Classifications are populated by the Road list's useRoadData() on mount; read the atom
  // directly here instead of useRoadData() so opening this dialog doesn't also mount a
  // second, unwanted paginated roads fetch (useRoadData() now owns a usePagination instance).
  const [roadClassifications] = useAtom(roadClassificationsAtom);
  const [formData, setFormData] = useState<Road>({
    Id: 0,
    RoadId: "",
    Name: "",
    NetworkStatusId: 0,
    Classification: 0,
    InfraExistingOrFutureId: 0,
    CreatedBy: '',
    CreatedDate: '',
    UpdatedBy: '',
    UpdatedDate: ''
  });

  // Debug log to see what we're getting
  console.log('roadClassifications in dialog:', roadClassifications);

  useEffect(() => {
    if (selectedItem && 'RoadId' in selectedItem && 'Classification' in selectedItem) {
      setFormData(selectedItem as Road); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // if (!formData.RoadId.startsWith("FR")) {
    //   alert("Road ID must start with 'FR'");
    //   return;
    // }

    if (!formData.RoadId || !formData.Name || !formData.Classification) {
      showToast({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    try {
      // Create payload with only the required fields for the API
      const roadPayload = {
        RoadId: formData.RoadId,
        Name: formData.Name,
        Classification: formData.Classification.toString(), // Convert to string if API expects string
      };

      const updatePayload = {...formData, Id: formData.Id};

      if (selectedItem) {
        const response = await editFutureRoad(updatePayload); // Call the service to add the future road
        if (response) {
          setRoads([...roads, formData]);
        }
        handleClose();
      }else {
        const response = await addFutureRoad(roadPayload); // Call the service to add the future road
        if (response) {
          setRoads([...roads, formData]);
        }
        handleClose();
      }
    } catch (error) {
      console.error("Error saving road:", error);
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
      Classification: 0,
      NetworkStatusId: 0,
      InfraExistingOrFutureId: 0,
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
                placeholder="Enter Road ID (must start with 'FR' and end with Island Code)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Road ID must start with 'FR' followed by 5 digit Number and ends with Island Code (e.g., FR00001LZ, FR00002VS)
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
                onChange={(e) => handleChange('Classification', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option value="">Select classification...</option>
                {Array.isArray(roadClassifications) && roadClassifications.length > 0 ? (
                  roadClassifications.map((classification) => (
                    <option key={classification.Id} value={classification.Id}>
                      {classification.Classification}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Loading classifications...</option>
                )}
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
