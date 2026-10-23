import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { Button } from '../../../components/tailwindui/button';
import { selectedItemAtom, roadsAtom, type RoadSection, type Road, deoListAtom } from "../state/rbiaAtoms";
import { addFutureRoadSection, editFutureRoadSection } from "../Service";
import type { FutureRoadSections } from "../Model.d";
import { useToast } from '../../../components/toaster/ToasterContext';

interface FutureRoadSectionDialogProps {
  onClose: () => void;
  road?: Road; // Optional road prop to pre-fill RoadId
  /** Called after a successful save so the list can re-fetch. */
  onSaved?: () => void;
}

const FutureRoadSectionDialog: React.FC<FutureRoadSectionDialogProps> = ({ onClose, road, onSaved }) => {
  const { showToast } = useToast();
  // const [futureRoadSections, setFutureRoadSections] = useAtom(roadSectionsAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  // Edit only for a selected *section* and never from a road row's "Add Section": the selection
  // is shared, so after any edit the Add flow used to post an edit with Id 0 and fail.
  const isEdit = !road && !!selectedItem && 'RoadSectionId' in selectedItem && !('BridgeId' in selectedItem);
  const [roads] = useAtom(roadsAtom);
  const [initRoadSections] = useAtom(deoListAtom);
  const getIslandCode = (roadId: string) => roadId.match(/[A-Za-z]+$/)?.[0] ?? "";

  const [sectionDigits, setSectionDigits] = useState("");

  const [formData, setFormData] = useState<RoadSection>({
    Id: 0,
    RoadId: road?.RoadId || "", // Pre-fill with road ID if provided
    RoadSectionId: "",
    RoadLength: 0,
    DEO: '',
    NetworkStatusId: 0,
    InfraExistingOrFutureId: 0,
    CreatedBy: '',
    CreatedDate: '',
    UpdatedBy: '',
    UpdatedDate: ''    
  });

  const currentIslandCode = getIslandCode(formData.RoadId);

  useEffect(() => {
    if (isEdit) {
      const item = selectedItem as RoadSection;
      setFormData(item);
      // Extract the 5-digit portion from the existing RoadSectionId (FS + 5digits + islandCode)
      const match = item.RoadSectionId.match(/^FS(\d{5})/);
      setSectionDigits(match ? match[1] : "");
    }
  }, [isEdit, selectedItem]);

  // The Section Road ID is never typed (S06-TC005-P001): Add gets the next free number from the API;
  // Edit keeps the section's number, under the island code of the road selected here.
  const editedSectionId = isEdit && sectionDigits && currentIslandCode ? `FS${sectionDigits}${currentIslandCode}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.RoadId) {
      showToast({ type: 'error', message: 'Please select a parent road.' });
      return;
    }

    if (!formData.RoadLength) {
      showToast({ type: 'error', message: 'Please enter the length.' });
      return;
    }

    if (!formData.DEO) {
      showToast({ type: 'error', message: 'Please select an engineering district.' });
      return;
    }

    try {
      const payload = {
        RoadId: formData.RoadId,
        RoadLength: formData.RoadLength.toString(),
        DEO: formData.DEO
      };
      if (isEdit) {
        // RoadLength must go as text: the API rejects a number for it ("Please provide a valid text value").
        await editFutureRoadSection({ ...formData, ...payload } as unknown as FutureRoadSections);
        showToast({ type: 'success', message: 'Future road section updated.' });
      } else {
        const response = await addFutureRoadSection(payload);
        showToast({ type: 'success', message: `Future road section ${response.Data.RoadSectionId} added.` });
      }
      onSaved?.();
      handleClose();
    } catch (error) {
      console.error("Error saving road section:", error);
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
    setSectionDigits("");
    setFormData({
      Id: 0,
      RoadId: road?.RoadId || "", // Preserve road ID if passed
      RoadSectionId: "",
      RoadLength: 0,
      DEO: "",
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
              {road ? `Add Road Section for ${road.RoadId} - ${road.Name}` : 
               isEdit ? "Edit Future Road Section" : "Add New Future Road Section"}
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
              {road ? (
                <>
                  <input
                    type="text"
                    value={`${formData.RoadId} - ${road.Name}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-900"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Road is automatically set from the selected road
                  </p>
                </>
              ) : (
                <>
                  <select
                    value={formData.RoadId}
                    onChange={(e) => handleChange('RoadId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    <option value="">Select Parent Road</option>
                    {/* roadsAtom only holds the page last shown in the Roads tab: keep the current parent selectable. */}
                    {formData.RoadId && !roads.some(r => r.RoadId === formData.RoadId) && (
                      <option value={formData.RoadId}>{formData.RoadId}</option>
                    )}
                    {roads.map((road) => (
                      <option key={road.RoadId} value={road.RoadId}>
                        {road.RoadId} - {road.Name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the parent road for this section
                  </p>
                </>
              )}
            </div>

            {/* Section Road ID: generated, read-only (S06-TC005-P001). */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Road ID</label>
              <input
                type="text"
                aria-label="Section Road ID"
                value={isEdit ? editedSectionId || formData.RoadSectionId : `FS·····${currentIslandCode}`}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-700 font-mono cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                {isEdit
                  ? "The number stays the same; the island code follows the selected road."
                  : "Generated when you save: FS, the next free 5-digit number, then the road's island code."}
              </p>
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Length (meters) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.RoadLength}
                onChange={(e) => handleChange('RoadLength', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Enter section length in meters (e.g., 520)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the road section length as a decimal number
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
              >
                <option value="">Select Engineering District</option>
                {Array.isArray(initRoadSections) && initRoadSections.map((deo) => (
                  <option key={deo.Id} value={deo.ParticipantId}>
                    {deo.Name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClose} color='zinc'>
                Cancel
              </Button>
              <Button type="submit" color='orange'>
                {isEdit ? "Update Road Section" : "Create Road Section"}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FutureRoadSectionDialog;
