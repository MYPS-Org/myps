import React, { useState } from 'react';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import AddInfraDialog from '../../Project/dialogs/AddInfraDialog';
import DeleteWorkLocationDialog from '../../Project/dialogs/deleteDialogs/DeleteWorkLocationDialog';
import { mockInfraData } from '../../Project/dialogs/mockInfraData';
import { generateInfraId, shouldAutoGenerateInfraId, getInfraTypePrefix } from '../../../utils/infraIdGenerator';
import type { MajorItemLocations, InfraData, ScopeOfWorkEnum, MajorItemOfWork } from '../../Project/Model.d';
import type { ProgramList } from '../../Program/Model';
import { getDisabledClass } from '../../../utils/GlobalFunctions';
import { unitTypeMap } from '../../Project/utils/unitTypes';

interface WorkLocationTableProps {
  majorItemOfWorks: MajorItemOfWork;
  workLocations: MajorItemLocations[];
  programDetails?: ProgramList;
  onAdd: (workLocation: MajorItemLocations) => void;
  onEdit: (index: number, workLocation: MajorItemLocations) => void;
  onDelete: (index: number) => void;
  infraData?: InfraData;
  workTypeId: number;
  dropDowns?: ScopeOfWorkEnum[];
  targetUnit: string;
  infraType: string;
  maxAmount?: number;
  minAmount?: number;
  parentId: string; // Add parentId prop
  disabled?: boolean;
}

const WorkLocationTable: React.FC<WorkLocationTableProps> = ({
  workLocations,
  onAdd,
  onEdit,
  onDelete,
  infraData,
  programDetails,
  workTypeId,
  targetUnit,
  majorItemOfWorks,
  maxAmount,
  minAmount,
  parentId,
  dropDowns,
  disabled = false,
}) => {
  const infraType = majorItemOfWorks.InfraType || '';
  const [infraDialogOpen, setInfraDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  // Helper function to check if a measure is length-based
  const isLengthBasedMeasure = (measure: string): boolean => {
    if (!measure) return false;
    const normalizedMeasure = measure.toLowerCase();
    return unitTypeMap[normalizedMeasure] === 'LENGTH';
  };
  
  // Helper function to determine if Length field should be required
  const isLengthRequired = (): boolean => {
    // Rule 1: If InfraType is Roads, Length is ALWAYS required
    if (infraType.toLowerCase() === 'roads' || infraType.toLowerCase() === 'road') {
      return true;
    }
    // Rule 2: If Measure is length-based, Length is required
    return isLengthBasedMeasure(actualTargetUnit);
  };
  
  // Helper function to determine if Length field should be visible
  const shouldShowLengthField = (): boolean => {
    // Rule 1: If InfraType is Roads, always show Length field (with chainages)
    if (infraType.toLowerCase() === 'roads' || infraType.toLowerCase() === 'road') {
      return true;
    }
    // Rule 2: Show if Measure is length-based
    return isLengthBasedMeasure(actualTargetUnit);
  };
  
  // Helper function to validate Length value
  const validateLength = (location: MajorItemLocations): { isValid: boolean; message: string } => {
    const isRoads = infraType.toLowerCase() === 'roads' || infraType.toLowerCase() === 'road';
    
    if (isRoads) {
      // For Roads: validate chainages
      const hasChainages = (location.StartChainage !== null && location.StartChainage !== undefined) 
        && (location.EndChainage !== null && location.EndChainage !== undefined);
      
      if (!hasChainages) {
        return { isValid: false, message: 'Start and End chainage are required for Roads' };
      }
      
      if (Number(location.EndChainage) <= Number(location.StartChainage)) {
        return { isValid: false, message: 'End chainage must be greater than Start chainage' };
      }
      
      return { isValid: true, message: '' };
    } else if (isLengthBasedMeasure(actualTargetUnit)) {
      // For non-Roads with length-based measure: validate length value
      if (location.Length === null || location.Length === undefined || location.Length <= 0) {
        return { isValid: false, message: `Length is required for ${actualTargetUnit}` };
      }
      
      // Validate against min/max amounts
      if (minAmount !== undefined && location.Length < minAmount) {
        return { isValid: false, message: `Length must be at least ${minAmount}` };
      }
      
      if (maxAmount !== undefined && location.Length > maxAmount) {
        return { isValid: false, message: `Length must not exceed ${maxAmount}` };
      }
      
      return { isValid: true, message: '' };
    }
    
    return { isValid: true, message: '' };
  };
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingWorkLocation, setDeletingWorkLocation] = useState<MajorItemLocations | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Helper function to get target unit name from workTypeId when targetUnit prop is empty
  const getTargetUnitName = (workTypeId: number): string => {
    if (targetUnit) return targetUnit; // Use prop if available
    const targetUnitData = dropDowns?.find(option => option.Enum === workTypeId);
    return targetUnitData?.Measure?.toString() || '';
  };

  // Get the actual target unit to use throughout the component
  const actualTargetUnit = getTargetUnitName(workTypeId);

  // Determine if we need to show the infrastructure dialog or just a text input
  const shouldUseInfraDialog = () => {
    return !shouldAutoGenerateInfraId(infraType);
  };

  const maxX = 126.8072562;
  const minX = 116.8879;
  const maxY = 21.3217806;
  const minY = 4.4149;

  const handleAddWorkLocation = () => {
    // Generate InfraId automatically for non-selectable infrastructure types
    const autoGeneratedInfraId = shouldAutoGenerateInfraId(infraType) 
      ? generateInfraId(infraType) 
      : '';

    // Get length from InfraId if available
    // const infraLength = autoGeneratedInfraId ? getInfraLength(autoGeneratedInfraId) : '';
    // const lengthValue = infraLength ? Number(infraLength) : null;

    const newWorkLocation: MajorItemLocations = {
      Id: 0, // Temporary ID
      ParentId: parentId, // Use the parentId from props (MajorItem's ReferenceId)
      StageName: programDetails?.StageName || '',
      InfraId: autoGeneratedInfraId,
      DetailedScope: '',
      TargetUnitId: workTypeId,
      TargetUnit: actualTargetUnit,
      Length: null,
      EndChainage: 0,
      StartChainage: 0,
      StartX: 0,
      StartY: 0,
      EndX: 0,
      EndY: 0,
      PhysicalTarget: null,
      StartStationLimit: '',
      EndStationLimit: '',
      IsDeleted: false
    };
    onAdd(newWorkLocation);
  };

  const handleCopyWorkLocation = (index: number) => {
    const locationToCopy = workLocations[index];
    
    // Create a copy with new ID and potentially modified InfraId
    const copiedLocation: MajorItemLocations = {
      ...locationToCopy,
      Id: 0, // New temporary ID
      // Generate new InfraId if auto-generated type, otherwise keep the same
      InfraId: shouldAutoGenerateInfraId(infraType) 
        ? generateInfraId(infraType) 
        : locationToCopy.InfraId,
      // Append "(Copy)" to detailed scope to indicate it's a duplicate
      DetailedScope: locationToCopy.DetailedScope 
        ? `${locationToCopy.DetailedScope} (Copy)`
        : '(Copy)',
      IsDeleted: false
    };
    
    onAdd(copiedLocation);
  };

  const handleEditWorkLocation = (index: number) => {
    if (shouldUseInfraDialog()) {
      setIsAddingNew(false);
      setEditingIndex(index);
      setInfraDialogOpen(true);
    }
  };

  const handleOpenDeleteDialog = (index: number) => {
    setDeletingWorkLocation(workLocations[index]);
    setDeletingIndex(index);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingWorkLocation(null);
    setDeletingIndex(null);
  };

  const handleConfirmDelete = (index: number) => {
    onDelete(index);
    handleCloseDeleteDialog();
  };

  const handleInfraSelect = (infraId: string, _infraName: string, _infraType: string) => {
    // Get length from the selected infrastructure
    const infraLength = getInfraLength(infraId);
    const lengthValue = infraLength ? Number(infraLength) : null;

    if (isAddingNew) {
      // Create new work location
      const newWorkLocation: MajorItemLocations = {
        Id: 0, // Temporary ID
        ParentId: parentId, // Use the parentId from props (MajorItem's ReferenceId)
        InfraId: infraId,
        StageName: programDetails?.StageName || '',
        DetailedScope: '',
        TargetUnitId: workTypeId,
        TargetUnit: actualTargetUnit,
        Length: null,
        EndChainage: 0,
        StartChainage: 0,
        StartX: 0,
        StartY: 0,
        EndX: 0,
        EndY: 0,
        PhysicalTarget: null,
        StartStationLimit: '',
        EndStationLimit: '',
        IsDeleted: false
      };
      onAdd(newWorkLocation);
    } else if (editingIndex !== null) {
      // Update existing work location
      const currentLocation = workLocations[editingIndex];
      const updatedWorkLocation = {
        ...currentLocation,
        InfraId: infraId,
        // Only auto-populate length if current length is empty or 0
        Length: (!currentLocation.Length || currentLocation.Length === 0) ? lengthValue : currentLocation.Length,
      };
      onEdit(editingIndex, updatedWorkLocation);
    }
    
    setInfraDialogOpen(false);
    setEditingIndex(null);
    setIsAddingNew(false);
  };

  const handleFieldChange = (index: number, field: keyof MajorItemLocations, value: any) => {
    const updatedWorkLocation = { ...workLocations[index], [field]: value };
    
    // Auto-calculate Length when chainages are updated
    if (field === 'StartChainage' || field === 'EndChainage') {
      const startChainage = field === 'StartChainage' ? Number(value) : Number(workLocations[index].StartChainage);
      const endChainage = field === 'EndChainage' ? Number(value) : Number(workLocations[index].EndChainage);
      
      // Calculate and update length if both chainages have values
      if (!isNaN(startChainage) && !isNaN(endChainage)) {
        updatedWorkLocation.Length = endChainage - startChainage;
      }
    }
    
    onEdit(index, updatedWorkLocation);
  };

  const getInfraLength = (infraId: string) => {
    if (!infraId) return '';
    
    // Use mock data for now (same as AddInfraDialog)
    const data = mockInfraData;
    
    // Check in RoadSections
    const roadSection = data.RoadSections?.find(road => road.RoadSectionId === infraId);
    if (roadSection) return roadSection.RoadLength?.toString() || '';
    
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

  // Calculate total physical target for all work locations
  // const getTotalPhysicalTarget = (): number => {
  //   return workLocations
  //     .filter(location => !location.IsDeleted)
  //     .reduce((total, location) => {
  //       return total + (location.PhysicalTarget || 0);
  //     }, 0);
  // };

  // Format number with commas0
  // const formatNumber = (num: number): string => {
  //   return num.toLocaleString('en-PH');
  // };

  const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.select();
    }
  };

  // Get fields based on infrastructure type
  const getFieldsForInfraType = () => {
    const infraTypeLower = infraType?.toLowerCase();
    
    if (infraTypeLower === 'road' || infraTypeLower === 'roads') {
      // For Roads: Always include Length with chainages
      return ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget', 'StartStationLimit', 'EndStationLimit', 'StartChainage','EndChainage', 'Length'];
    } else if (infraTypeLower === 'bridge' || infraTypeLower === 'bridges') {
      // For Bridges: Include Length only if measure is length-based
      const baseFields = ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    } else if (infraTypeLower === 'cos' || infraTypeLower === 'non-infra') {
      // For CoS/Non-Infra: Include Length only if measure is length-based
      const baseFields = ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    } else {
      // Others - use coordinates, include Length only if measure is length-based
      const baseFields = ['InfraId','DetailedScope', 'TargetUnit','PhysicalTarget','StartX', 'StartY', 'EndX', 'EndY'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    }
  };

  const renderCoordinatesRange = (coordinate: string) => {
    if (coordinate === 'X') {
      return (
        <div className="text-xs text-gray-500">
          Range: 116.8879 - 126.6050
        </div>
      )
    } else if (coordinate === 'Y') {
      return (
        <div className="text-xs text-gray-500">
          Range: 4.4149 - 21.1218
        </div>
      )
    }
  };

  // Render individual form fields based on field type and infrastructure type
  const renderFormField = (location: MajorItemLocations, index: number, fieldName: string) => {
    switch (fieldName) {
      case 'InfraId':
        const canSelectInfra = shouldUseInfraDialog();
        const canAutoGenerate = shouldAutoGenerateInfraId(infraType);
        
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Infrastructure ID
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={location.InfraId}
                onChange={canSelectInfra ? undefined : (e) => {
                  handleFieldChange(index, 'InfraId', e.target.value);
                  // Auto-populate length if available and current length is empty or 0
                  const newInfraLength = getInfraLength(e.target.value);
                  if (newInfraLength && (!location.Length || location.Length === 0)) {
                    handleFieldChange(index, 'Length', Number(newInfraLength));
                  }
                }}
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
                placeholder={canSelectInfra ? "Click to select infrastructure..." : canAutoGenerate ? "Auto-generated or enter custom ID..." : "Enter infrastructure ID..."}
                readOnly={canSelectInfra}
              />
              {canSelectInfra && (
                <Button
                  color="blue"
                  onClick={() => handleEditWorkLocation(index)}
                  className={`text-sm px-3 py-2 ${getDisabledClass(disabled)}`}
                  disabled={disabled}
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
              )}
              {canAutoGenerate && (
                <Button
                  color="green"
                  disabled={disabled}
                  onClick={() => {
                    const newId = generateInfraId(infraType);
                    handleFieldChange(index, 'InfraId', newId);
                    // Auto-populate length if available and current length is empty or 0
                    const newInfraLength = getInfraLength(newId);
                    if (newInfraLength && (!location.Length || location.Length === 0)) {
                      handleFieldChange(index, 'Length', Number(newInfraLength));
                    }
                  }}
                  className={`text-sm px-3 py-2 ${getDisabledClass(disabled)}`}
                  title="Generate new Infrastructure ID"
                >
                  Generate ID
                </Button>
              )}
            </div>
            {location.InfraId && getInfraLength(location.InfraId) && (
              <div className="text-xs text-gray-500">
                Length: {getInfraLength(location.InfraId)} meters
              </div>
            )}
            {canAutoGenerate && (
              <div className="text-xs text-blue-600">
                Auto-generated IDs follow format: {infraType ? getInfraTypePrefix(infraType) : 'PREFIX'}+5 random numbers
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="Enter detailed scope of work..."
              rows={3}
              disabled={disabled}
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
              value={location.TargetUnit || actualTargetUnit}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
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
              Physical Target ({actualTargetUnit})
            </label>
            <input
              type="number"
              value={location.PhysicalTarget !== null && location.PhysicalTarget !== undefined ? location.PhysicalTarget : ''}
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="Enter target amount..."
              disabled={disabled}
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
              Start Station
            </label>
            <input
              type="text"
              value={location.StartStationLimit}
              onChange={(e) => handleFieldChange(index, 'StartStationLimit', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="Start station..."
              disabled={disabled}
            />
          </div>
        );

      case 'EndStationLimit':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Station
            </label>
            <input
              type="text"
              value={location.EndStationLimit}
              onChange={(e) => handleFieldChange(index, 'EndStationLimit', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="End station..."
              disabled={disabled}
            />
          </div>
        );
      
      case 'EndChainage': 
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Chainage (m)
            </label>
            <input
              type="number"
              value={location.EndChainage ?? ''}
              onFocus={handleNumberFocus}
              onChange={(e) => handleFieldChange(index, 'EndChainage', Number(e.target.value))}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${getDisabledClass(disabled)}`}
              placeholder="To..."
              disabled={disabled}
            />
          </div>
        );

      case 'StartChainage':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Chainage (m)
            </label>
            <input
              type="number"
              value={location.StartChainage ?? ''}
              onFocus={handleNumberFocus}
              onChange={(e) => handleFieldChange(index, 'StartChainage', Number(e.target.value))}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${getDisabledClass(disabled)}`}  
              placeholder="From..."
              disabled={disabled}
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
              type="number"
              value={location.StartX}
              onChange={(e) => handleFieldChange(index, 'StartX', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="Start X coordinate..."
              min={minX}
              max={maxX}
              disabled={disabled}
            />
            {renderCoordinatesRange('X')}
          </div>
        );

      case 'StartY':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Y Coordinate
            </label>
            <input
              type="number"
              value={location.StartY}
              onChange={(e) => handleFieldChange(index, 'StartY', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="Start Y coordinate..."
              min={minY}
              max={maxY}
              disabled={disabled}
            />
            {renderCoordinatesRange('Y')}
          </div>
        );

      case 'EndX':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End X Coordinate <span className="text-xs text-gray-500">(Optional for point features)</span>
            </label>
            <input
              type="number"
              value={location.EndX || ''}
              onChange={(e) => handleFieldChange(index, 'EndX', e.target.value ? Number(e.target.value) : null)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="End X coordinate (leave empty for point)..."
              min={minX}
              max={maxX}
              disabled={disabled}
            />
            {renderCoordinatesRange('X')}
          </div>
        );

      case 'EndY':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Y Coordinate <span className="text-xs text-gray-500">(Optional for point features)</span>
            </label>
            <input
              type="number"
              value={location.EndY || ''}
              onChange={(e) => handleFieldChange(index, 'EndY', e.target.value ? Number(e.target.value) : null)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(disabled)}`}
              placeholder="End Y coordinate (leave empty for point)..."
              min={minY}
              max={maxY}
              disabled={disabled}
            />
            {renderCoordinatesRange('Y')}
          </div>
        );
      
      case 'Length':
        const isRoads = infraType.toLowerCase() === 'roads' || infraType.toLowerCase() === 'road';
        const validation = validateLength(location);
        
        // For Roads: Calculate from chainages
        if (isRoads) {
          const difference = location.EndChainage - location.StartChainage;
          const absoluteDifference = Math.abs(difference);
          
          // Check if both chainages are provided (including 0 as valid value)
          const hasChainages = (location.StartChainage !== null && location.StartChainage !== undefined) 
            && (location.EndChainage !== null && location.EndChainage !== undefined);
          
          // Use calculated difference if chainages are provided
          const displayLength = hasChainages ? difference.toString() : '';
          
          // Show info or error message
          const shouldShowInfo = hasChainages && absoluteDifference > 0;
          const hasError = !validation.isValid;
          
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-900">
                Length (km) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayLength}
                  className={`w-full px-3 py-2 border rounded-md text-sm bg-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${
                    hasError ? 'border-red-500' : 'border-gray-300'
                  } ${getDisabledClass(disabled)}`}
                  placeholder="Calculated from chainages"
                  readOnly
                  disabled={disabled}
                />
              </div>
              {shouldShowInfo && !hasError && (
                <div className="text-xs text-blue-600 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Auto-calculated: {absoluteDifference.toFixed(3)} km from chainages</span>
                </div>
              )}
              {hasError && (
                <div className="text-xs text-red-600 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{validation.message}</span>
                </div>
              )}
              <div className="text-xs text-gray-500">
                Calculated automatically from Start and End Chainage
              </div>
            </div>
          );
        } else {
          // For non-Roads: Simple numeric input
          const displayLength = location.Length !== null && location.Length !== undefined ? location.Length.toString() : '';
          const hasError = !validation.isValid && displayLength !== '';
          const isRequired = isLengthRequired();
          
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-900">
                Length ({actualTargetUnit}) {isRequired && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={displayLength}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFieldChange(index, 'Length', value ? Number(value) : null);
                  }}
                  onFocus={handleNumberFocus}
                  step="0.001"
                  min={minAmount}
                  max={maxAmount}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${
                    hasError ? 'border-red-500' : 'border-gray-300'
                  } ${getDisabledClass(disabled)}`}
                  placeholder={`Enter length in ${actualTargetUnit}...`}
                  disabled={disabled}
                />
              </div>
              {hasError && (
                <div className="text-xs text-red-600 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{validation.message}</span>
                </div>
              )}
              {(maxAmount || minAmount) && (
                <div className="text-xs text-gray-500">
                  Range: {minAmount || 0} - {maxAmount || '∞'} {actualTargetUnit}
                </div>
              )}
            </div>
          );
        }
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
            Configure work location for {infraType || 'this project'}
          </p>
        </div>
        {/* Summary Card */}
        {/* {workLocations.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 text-center min-w-[180px]">
            <div className="text-xs text-gray-600">Total Physical Target</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatNumber(getTotalPhysicalTarget())} {actualTargetUnit}
            </div>
            <div className="text-xs text-gray-500">
              {workLocations.length} location{workLocations.length !== 1 ? 's' : ''}
            </div>
          </div>
        )} */}
      </div>

      {workLocations.filter(loc => !loc.IsDeleted).length > 0 ? (
        
        <div className="space-y-6">
          {workLocations.map((location, index) => {
            if (location.IsDeleted) return null;
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
                  <div className="flex space-x-2">
                    <Button
                      color="blue"
                      onClick={() => handleCopyWorkLocation(index)}
                      className={`flex items-center px-3 py-1 text-xs ${getDisabledClass(disabled)}`}
                      disabled={disabled}
                      title="Duplicate this location"
                    >
                      <DocumentDuplicateIcon className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      color="red"
                      onClick={() => handleOpenDeleteDialog(index)}
                      className={`flex items-center px-3 py-1 text-xs ${getDisabledClass(disabled)}`}
                      disabled={disabled}
                    >
                      <TrashIcon className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
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
                ) : (infraType?.toLowerCase() === 'consultancy' || infraType?.toLowerCase() === 'non-infra') ? (
                  <div className="mt-4 p-3 bg-orange-50 rounded-md">
                    <div className="text-sm text-orange-500">
                      <strong>Consultancy Infrastructure:</strong> No Geo-Location available for this infrastructure.
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                    <div className="text-sm text-yellow-700">
                      <strong>Other Infrastructure:</strong> Use coordinate fields to define location. Fill Start X/Y for point features, or add End X/Y for line/area features.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className='flex justify-center'>
          <Button
              color="blue"
              onClick={handleAddWorkLocation}
              className={`flex items-center px-4 py-2 text-sm ${getDisabledClass(disabled)}`}
              disabled={disabled}
            >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Location
          </Button>
          </div>
        </div>
        
        
      ) : (
        <div onClick={handleAddWorkLocation} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 cursor-pointer">
          <div className="max-w-sm mx-auto">
            <div className="mb-4">
              <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <PlusIcon className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No work Target</h3>
            <p className="text-sm text-gray-500 mb-4 text-wrap">
              Get started by adding your first work target. The form will adapt based on your infrastructure type ({infraType || 'Not specified'}).
            </p>
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
          infraType={infraType}
          mode="add"
        />
      )}

      {/* Delete Work Location Dialog */}
      <DeleteWorkLocationDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirmDelete={handleConfirmDelete}
        workLocation={deletingWorkLocation}
        deleteIndex={deletingIndex}
        infraType={infraType}
      />
    </div>
  );
};

export default WorkLocationTable;
