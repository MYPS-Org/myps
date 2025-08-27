import React, { useState } from 'react';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import AddInfraDialog from '../dialogs/AddInfraDialog';
import { mockInfraData } from '../dialogs/mockInfraData';
import type { WorkLocation, InfraData } from '../Model';

interface WorkLocationTableProps {
  workLocations: WorkLocation[];
  onAdd: (workLocation: WorkLocation) => void;
  onEdit: (index: number, workLocation: WorkLocation) => void;
  onDelete: (index: number) => void;
  infraData?: InfraData;
  workTypeId: number;
  targetUnit: string;
  infraType: string;
  maxAmount?: number;
  minAmount?: number;
}

const WorkLocationTable: React.FC<WorkLocationTableProps> = ({
  workLocations,
  onAdd,
  onEdit,
  onDelete,
  infraData,
  workTypeId,
  targetUnit,
  infraType,
  maxAmount,
  minAmount
}) => {
  const [infraDialogOpen, setInfraDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Determine if we need to show the infrastructure dialog or just a text input
  const shouldUseInfraDialog = () => {
    const infraTypeLower = infraType?.toLowerCase();
    return infraTypeLower === 'road' || infraTypeLower === 'roads' || 
           infraTypeLower === 'bridge' || infraTypeLower === 'bridges';
  };

  const handleAddWorkLocation = () => {
    // Always create a new empty work location form directly
    const newWorkLocation: WorkLocation = {
      InfraId: '',
      DetailedScope: '',
      TargetUnitId: workTypeId,
      TargetUnit: targetUnit,
      StartX: '',
      StartY: '',
      EndX: '',
      EndY: '',
      PhysicalTarget: '',
      StartStationLimit: '',
      EndStationLimit: '',
    };
    onAdd(newWorkLocation);
  };

  const handleEditWorkLocation = (index: number) => {
    if (shouldUseInfraDialog()) {
      setIsAddingNew(false);
      setEditingIndex(index);
      setInfraDialogOpen(true);
    }
  };

  const handleInfraSelect = (infraId: string, _infraName: string, _infraType: string) => {
    if (isAddingNew) {
      // Create new work location
      const newWorkLocation: WorkLocation = {
        InfraId: infraId,
        DetailedScope: '',
        TargetUnitId: workTypeId,
        TargetUnit: targetUnit,
        StartX: '',
        StartY: '',
        EndX: '',
        EndY: '',
        PhysicalTarget: '',
        StartStationLimit: '',
        EndStationLimit: '',
      };
      onAdd(newWorkLocation);
    } else if (editingIndex !== null) {
      // Update existing work location
      const updatedWorkLocation = {
        ...workLocations[editingIndex],
        InfraId: infraId,
      };
      onEdit(editingIndex, updatedWorkLocation);
    }
    
    setInfraDialogOpen(false);
    setEditingIndex(null);
    setIsAddingNew(false);
  };

  const handleFieldChange = (index: number, field: keyof WorkLocation, value: any) => {
    const updatedWorkLocation = { ...workLocations[index], [field]: value };
    onEdit(index, updatedWorkLocation);
  };

  const getInfraLength = (infraId: string) => {
    if (!infraId) return '';
    
    // Use mock data for now (same as AddInfraDialog)
    const data = mockInfraData;
    
    // Check in RoadSections
    const roadSection = data.RoadSections?.find(road => road.SectionId === infraId);
    if (roadSection) return roadSection.SectionLength?.toString() || '';
    
    // Check in Bridges
    const bridge = data.Bridges?.find(bridge => bridge.BridgeId === infraId);
    if (bridge) return bridge.Length?.toString() || '';
    
    // Check in FCS (might not have length properties)
    const fcs = data.FCS?.find(f => f.FCSId === infraId);
    if (fcs) return ''; // FCS typically don't have length
    
    // Check in OtherInfra (might not have length properties)  
    const other = data.OtherInfra?.find(o => o.InfraId === infraId);
    if (other) return ''; // Other infra might not have standardized length
    
    return '';
  };

  const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.select();
    }
  };

  // Get fields based on infrastructure type
  const getFieldsForInfraType = () => {
    const infraTypeLower = infraType?.toLowerCase();
    
    if (infraTypeLower === 'road' || infraTypeLower === 'roads') {
      return ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget', 'StartStationLimit', 'EndStationLimit'];
    } else if (infraTypeLower === 'bridge' || infraTypeLower === 'bridges') {
      return ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget'];
    } else {
      // Others - use coordinates
      return ['InfraId', 'StartX', 'StartY', 'EndX', 'EndY'];
    }
  };

  // Render individual form fields based on field type and infrastructure type
  const renderFormField = (location: WorkLocation, index: number, fieldName: string) => {
    switch (fieldName) {
      case 'InfraId':
        const canSelectInfra = shouldUseInfraDialog();
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Infrastructure ID
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={location.InfraId}
                onChange={canSelectInfra ? undefined : (e) => handleFieldChange(index, 'InfraId', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder={canSelectInfra ? "Click to select infrastructure..." : "Enter infrastructure ID..."}
                readOnly={canSelectInfra}
              />
              {canSelectInfra && (
                <Button
                  color="blue"
                  onClick={() => handleEditWorkLocation(index)}
                  className="text-sm px-3 py-2"
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
            {location.InfraId && getInfraLength(location.InfraId) && (
              <div className="text-xs text-gray-500">
                Length: {getInfraLength(location.InfraId)} meters
              </div>
            )}
          </div>
        );

      case 'DetailedScope':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Detailed Scope
            </label>
            <textarea
              value={location.DetailedScope}
              onChange={(e) => handleFieldChange(index, 'DetailedScope', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter detailed scope of work..."
              rows={3}
            />
          </div>
        );

      case 'TargetUnit':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Target Unit
            </label>
            <input
              type="text"
              value={targetUnit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Target unit"
              readOnly
            />
            <div className="text-xs text-gray-500">
              Based on selected work type
            </div>
          </div>
        );

      case 'PhysicalTarget':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Physical Target ({targetUnit})
            </label>
            <input
              type="number"
              value={location.PhysicalTarget}
              onChange={(e) => {
                const value = Number(e.target.value);
                // Validate against min/max bounds
                if (maxAmount !== undefined && value > maxAmount) {
                  return; // Don't update if exceeds max
                }
                if (minAmount !== undefined && value < minAmount) {
                  return; // Don't update if below min
                }
                handleFieldChange(index, 'PhysicalTarget', value);
              }}
              onFocus={handleNumberFocus}
              max={maxAmount}
              min={minAmount}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter target amount..."
            />
            {(maxAmount || minAmount) && (
              <div className="text-xs text-gray-500">
                Range: {minAmount || 0} - {maxAmount || '∞'}
              </div>
            )}
          </div>
        );

      case 'StartStationLimit':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Station (km)
            </label>
            <input
              type="text"
              value={location.StartStationLimit}
              onChange={(e) => handleFieldChange(index, 'StartStationLimit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Start station..."
            />
          </div>
        );

      case 'EndStationLimit':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Station (km)
            </label>
            <input
              type="text"
              value={location.EndStationLimit}
              onChange={(e) => handleFieldChange(index, 'EndStationLimit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="End station..."
            />
          </div>
        );

      case 'StartX':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start X Coordinate
            </label>
            <input
              type="text"
              value={location.StartX}
              onChange={(e) => handleFieldChange(index, 'StartX', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Start X coordinate..."
            />
          </div>
        );

      case 'StartY':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Y Coordinate
            </label>
            <input
              type="text"
              value={location.StartY}
              onChange={(e) => handleFieldChange(index, 'StartY', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Start Y coordinate..."
            />
          </div>
        );

      case 'EndX':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End X Coordinate
            </label>
            <input
              type="text"
              value={location.EndX}
              onChange={(e) => handleFieldChange(index, 'EndX', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="End X coordinate..."
            />
          </div>
        );

      case 'EndY':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Y Coordinate
            </label>
            <input
              type="text"
              value={location.EndY}
              onChange={(e) => handleFieldChange(index, 'EndY', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="End Y coordinate..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="m-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-800">Work Locations</h4>
          <p className="text-sm text-gray-600 mt-1">
            Configure work locations for {infraType || 'this project'}
          </p>
        </div>
        <Button
          color="blue"
          onClick={handleAddWorkLocation}
          className="flex items-center px-4 py-2 text-sm"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      </div>

      {workLocations.length > 0 ? (
        <div className="space-y-6">
          {workLocations.map((location, index) => {
            const fields = getFieldsForInfraType();
            return (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <h5 className="text-md font-medium text-gray-800">
                    Location {index + 1}
                    {location.InfraId && (
                      <span className="text-sm text-gray-500 font-normal ml-2">
                        ({location.InfraId})
                      </span>
                    )}
                  </h5>
                  <Button
                    color="red"
                    onClick={() => onDelete(index)}
                    className="flex items-center px-3 py-1 text-xs"
                  >
                    <TrashIcon className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map((fieldName) => renderFormField(location, index, fieldName))}
                </div>

                {/* Infrastructure Type Specific Information */}
                {(infraType?.toLowerCase() === 'road' || infraType?.toLowerCase() === 'roads') ? (
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <div className="flex items-center">
                      <div className="text-sm text-blue-700">
                        <strong>Road Infrastructure:</strong> Station limits represent kilometer markers along the road section.
                      </div>
                    </div>
                  </div>
                ) : (infraType?.toLowerCase() === 'bridge' || infraType?.toLowerCase() === 'bridges') ? (
                  <div className="mt-4 p-3 bg-green-50 rounded-md">
                    <div className="text-sm text-green-700">
                      <strong>Bridge Infrastructure:</strong> Length and target units are automatically determined based on the selected bridge.
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                    <div className="text-sm text-yellow-700">
                      <strong>Other Infrastructure:</strong> Use coordinate fields to define precise location boundaries.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
          <div className="max-w-sm mx-auto">
            <div className="mb-4">
              <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <PlusIcon className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No work locations</h3>
            <p className="text-sm text-gray-500 mb-4">
              Get started by adding your first work location. The form will adapt based on your infrastructure type ({infraType || 'Not specified'}).
            </p>
            <Button
              color="blue"
              onClick={handleAddWorkLocation}
              className="flex items-center mx-auto px-4 py-2"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add First Location
            </Button>
          </div>
        </div>
      )}

      {/* Add Infrastructure Dialog - Only for Roads and Bridges */}
      {shouldUseInfraDialog() && (
        <AddInfraDialog
          isOpen={infraDialogOpen}
          onClose={() => {
            setInfraDialogOpen(false);
            setEditingIndex(null);
            setIsAddingNew(false);
          }}
          onAdd={handleInfraSelect}
          initialData={infraData}
          mode="add"
        />
      )}
    </div>
  );
};

export default WorkLocationTable;
