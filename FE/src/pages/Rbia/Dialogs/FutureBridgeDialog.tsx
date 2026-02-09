import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { Button } from '../../../components/tailwindui/button';
import { selectedItemAtom, roadSectionsAtom, type Bridge, type RoadSection } from "../state/rbiaAtoms";
import { addFutureBridge, editFutureBridge } from "../Service";

interface FutureBridgeDialogProps {
  onClose: () => void;
  roadSection?: RoadSection; // Pass the road section to pre-fill RoadSectionId
}

const FutureBridgeDialog: React.FC<FutureBridgeDialogProps> = ({ onClose, roadSection }) => {
  // const [bridges, setBridges] = useAtom(bridgesAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  const [roadSections] = useAtom(roadSectionsAtom);
  const [formData, setFormData] = useState<Bridge>({
    Id: 0,
    RoadSectionId: roadSection?.RoadSectionId || '', // Pre-fill with road section ID if provided
    BridgeId: "",
    Name: "",
    From: 0,
    Length: 0,
    CarriageWay: 0,
    OverallWidth: 0,
    NetworkStatusId: 0,
    InfraExistingOrFutureId: 0,
    CreatedBy: '',
    CreatedDate: '',
    UpdatedBy: '',
    UpdatedDate: ''
  });

  useEffect(() => {
    if (selectedItem && 'CarriageWay' in selectedItem) {
      setFormData(selectedItem as Bridge); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.RoadSectionId || !formData.Name || 
        !formData.From || !formData.Length || !formData.CarriageWay ) {
      alert("Please fill in all required fields with valid values");
      return;
    }

    try {
      const payload = {
        RoadSectionId: formData.RoadSectionId,
        BridgeId: formData.BridgeId,
        Name: formData.Name,
        From: formData.From,
        OverallWidth: formData.OverallWidth,
        NetworkStatusId: formData.NetworkStatusId,
        InfraExistingOrFutureId: formData.InfraExistingOrFutureId,
        Length: formData.Length,
        CarriageWay: formData.CarriageWay
      }

      const updatePayload = {...formData, Id: formData.Id};
      if (selectedItem) {
        const response = await editFutureBridge(updatePayload); // Call the service to add the future bridge
        if (response) {
          console.log("Bridge updated successfully:", response);
        }
      }
      else {
        const response = await addFutureBridge(payload); // Call the service to add the future bridge
        if (response) {
          console.log("Bridge added successfully:", response);
        }
      }
      handleClose();
    } catch (error) {
      console.error("Error saving bridge:", error);
      alert("Failed to save bridge. Please try again.");
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
      RoadSectionId: "",
      BridgeId: "",
      Name: "",
      From: 0,
      Length: 0,
      CarriageWay: 0,
      OverallWidth: 0,
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
              {selectedItem ? "Edit Future Bridge" : "Add New Future Bridge"}
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Section Road ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Road ID <span className="text-red-500">*</span>
              </label>
              {roadSection ? (
                <>
                  <input
                    type="text"
                    value={roadSection.RoadSectionId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 text-gray-900"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This is the ID of the road section where the bridge will be located.
                  </p>
                </>
              ) : (
              <>
                <select
                  value={formData.RoadSectionId}
                  onChange={(e) => handleChange('RoadSectionId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  required
                >
                  <option value="">Select Road Section</option>
                  {roadSections.map((section) => (
                    <option key={section.RoadSectionId} value={section.RoadSectionId}>
                      {section.RoadSectionId} - {section.RoadLength}km (District {section.DEO})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select the road section where this bridge will be located
                </p>
                </>
              )}
            </div>

            {/* Bridge Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bridge ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.BridgeId}
                onChange={(e) => handleChange('BridgeId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter Bridge ID (must start with 'FB')"
              />
              <p className="text-xs text-gray-500 mt-1">
                Section Road ID must start with 'FS' (e.g., S001-001, FS001-002)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bridge Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.Name}
                onChange={(e) => handleChange('Name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter bridge name"
              />
            </div>

            {/* From Chainage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Chainage (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.From}
                onChange={(e) => handleChange('From', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter starting chainage in kilometers"
              />
              <p className="text-xs text-gray-500 mt-1">
                Starting point of the bridge along the road section
              </p>
            </div>

            {/* Bridge Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bridge Length (m) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.Length}
                onChange={(e) => handleChange('Length', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter bridge length in meters"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total length of the bridge structure
              </p>
            </div>

            {/* Carriage Way */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight of Carriage Ways (Kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.CarriageWay || ''}
                onChange={(e) => handleChange('CarriageWay', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                required
                placeholder="Enter weight capacity of carriage ways"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total weight capacity of the bridge's carriage ways in kilograms
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClose} color='zinc'>
                Cancel
              </Button>
              <Button type="submit" color='orange'>
                {selectedItem ? "Update Bridge" : "Create Bridge"}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FutureBridgeDialog;
