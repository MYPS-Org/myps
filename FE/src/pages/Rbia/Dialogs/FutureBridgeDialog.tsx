import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { Button } from '../../../components/tailwindui/button';
import { selectedItemAtom, roadSectionsAtom, type Bridge, type RoadSection } from "../state/rbiaAtoms";
import { addFutureBridge, editFutureBridge } from "../Service";
import { useToast } from '../../../components/toaster/ToasterContext';

interface FutureBridgeDialogProps {
  onClose: () => void;
  roadSection?: RoadSection; // Pass the road section to pre-fill RoadSectionId
  /** Called after a successful save so the list can re-fetch. */
  onSaved?: () => void;
}

const FutureBridgeDialog: React.FC<FutureBridgeDialogProps> = ({ onClose, roadSection, onSaved }) => {
  const { showToast } = useToast();
  // const [bridges, setBridges] = useAtom(bridgesAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  // Edit only for a selected *bridge* and never from a section row's "Add Bridge" (shared selection).
  const isEdit = !roadSection && !!selectedItem && 'BridgeId' in selectedItem;
  const [roadSections] = useAtom(roadSectionsAtom);
  const getIslandCode = (sectionId: string) => sectionId.match(/[A-Za-z]+$/)?.[0] ?? "";
  const [bridgeDigits, setBridgeDigits] = useState("");
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

  const currentIslandCode = getIslandCode(formData.RoadSectionId);

  useEffect(() => {
    if (isEdit) {
      const item = selectedItem as Bridge;
      setFormData(item);
      const match = item.BridgeId.match(/^FB(\d{5})/);
      setBridgeDigits(match ? match[1] : "");
    }
  }, [isEdit, selectedItem]);

  useEffect(() => {
    const islandCode = getIslandCode(formData.RoadSectionId);
    const padded = bridgeDigits.padStart(5, "0");
    setFormData(prev => ({
      ...prev,
      BridgeId: bridgeDigits ? `FB${padded}${islandCode}` : ""
    }));
  }, [bridgeDigits, formData.RoadSectionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // From Chainage may legitimately be 0 (start of the section); it only has to be a number.
    if (!formData.RoadSectionId || !formData.Name || !Number.isFinite(Number(formData.From)) ||
        !formData.Length || !formData.CarriageWay ) {
      showToast({ type: 'error', message: 'Please fill in all required fields with valid values.' });
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

      if (isEdit) {
        await editFutureBridge({ ...formData, Id: formData.Id, OverallWidth: formData.OverallWidth ?? 0 });
        showToast({ type: 'success', message: 'Future bridge updated.' });
      }
      else {
        await addFutureBridge(payload);
        showToast({ type: 'success', message: 'Future bridge added.' });
      }
      onSaved?.();
      handleClose();
    } catch (error) {
      console.error("Error saving bridge:", error)
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
    setBridgeDigits("");
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
        {/* max-h + scroll: on a 720px-high screen the form ran past the viewport and the submit button could not be reached. */}
        <DialogPanel className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {isEdit ? "Edit Future Bridge" : "Add New Future Bridge"}
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
                >
                  <option value="">Select Road Section</option>
                  {/* roadSectionsAtom only holds the page last shown: keep the current section selectable. */}
                  {formData.RoadSectionId && !roadSections.some(s => s.RoadSectionId === formData.RoadSectionId) && (
                    <option value={formData.RoadSectionId}>{formData.RoadSectionId}</option>
                  )}
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

            {/* Bridge ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bridge ID <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border border-gray-300 rounded-md shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white overflow-hidden">
                <span className="px-3 py-2 bg-gray-100 text-gray-500 font-mono text-sm border-r border-gray-300 select-none">
                  FB
                </span>
                <input
                  type="text"
                  value={bridgeDigits}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setBridgeDigits(val);
                  }}
                  className="flex-1 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none font-mono"
                  placeholder="00001"
                  maxLength={5}
                />
                <span className="px-3 py-2 bg-gray-100 text-gray-500 font-mono text-sm border-l border-gray-300 select-none min-w-[40px] text-center">
                  {currentIslandCode || "???"}
                </span>
              </div>
              {formData.BridgeId && (
                <p className="text-xs text-blue-600 mt-1 font-mono">
                  Full ID: {formData.BridgeId}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Enter the 5-digit number. The island code is derived from the selected road section.
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
                placeholder="Enter bridge length in meters"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total length of the bridge structure
              </p>
            </div>

            {/* Carriage Way Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carriageway Width (m) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.CarriageWay || ''}
                onChange={(e) => handleChange('CarriageWay', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Enter carriageway width in meters"
              />
              <p className="text-xs text-gray-500 mt-1">
                Width of the carriageway in meters
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClose} color='zinc'>
                Cancel
              </Button>
              <Button type="submit" color='orange'>
                {isEdit ? "Update Bridge" : "Create Bridge"}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FutureBridgeDialog;
