import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '../../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import AddInfraDialog from '../../../Project/dialogs/AddInfraDialog';
import DeleteWorkLocationDialog from '../../dialogs/deleteDialog/DeleteWorkLocationDialog';
import { useDeleteWorkLocationDialog } from '../../hooks/useDeleteWorkLocationDialog';
import { generateInfraId, shouldAutoGenerateInfraId, getInfraTypePrefix, isLocalInfraType, isRoadInfraType, isBridgeInfraType } from '../../../../utils/infraIdGenerator';
import type { MajorItemLocations, InfraData, ScopeOfWorkEnum, MajorItemOfWork } from '../../../Project/Model.d';
import type { ProgramList } from '../../../Program/Model';
import type { FieldRules } from '../../Model';
import { getDisabledClass } from '../../../../utils/GlobalFunctions';
import { unitTypeMap } from '../../../Project/utils/unitTypes';
import { defaultCoordinates } from '../../../Project/utils/coordinates';

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
  fieldRules?: FieldRules | null;
  deo?: string;
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
  fieldRules,
  deo,
}) => {
  const infraType = majorItemOfWorks.InfraType || '';

  // InfraType guard helpers — based on InfraCode
  // National Road: InfraCode 'R' (not local LR)
  const isRoadType = (): boolean => isRoadInfraType(infraType);
  // National Bridge: InfraCode 'B' (not local LB)
  const isBridgeType = (): boolean => isBridgeInfraType(infraType);
  // Local Infra: LR, LB, LFCS, LWW, etc. (L-prefix, ≥2 chars)
  const isLocalType = (): boolean => isLocalInfraType(infraType);

  const [infraDialogOpen, setInfraDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { openDeleteDialog } = useDeleteWorkLocationDialog();

  // Helper function to build field permissions map from fieldRules
  const fieldPermissionsMap = useMemo(() => {
    if (!fieldRules) return {};

    const permissions: Record<string, boolean> = {};

    // Root-level fields
    for (const [key, value] of Object.entries(fieldRules)) {
      if (typeof value === 'boolean') {
        permissions[key] = value;
      }
    }

    // Check MajorItemLocationRules specifically for work location fields
    if (fieldRules.MajorItemLocationRules) {
      const locationRules = fieldRules.MajorItemLocationRules as any;
      
      // Get fields from MajorItemLocationRules.Fields
      if (locationRules.Fields) {
        Object.assign(permissions, locationRules.Fields);
      }
    }
    return permissions;
  }, [fieldRules]);

  // Function to check if a specific field is editable (matching MajorItemOfWorksForm pattern)
  const isFieldEditable = useCallback((field: string) => {
    return fieldPermissionsMap[field] === true;
  }, [fieldPermissionsMap]);

  // Individual field editability checks for cleaner usage
  const isInfraIdEditable = isFieldEditable('InfraId');
  const isDetailedScopeEditable = isFieldEditable('DetailedScope');
  // const isTargetUnitEditable = isFieldEditable('TargetUnit');
  const isPhysicalTargetEditable = isFieldEditable('PhysicalTarget');
  const isStartStationLimitEditable = isFieldEditable('StartStationLimit');
  const isEndStationLimitEditable = isFieldEditable('EndStationLimit');
  const isStartChainageEditable = isFieldEditable('StartChainage');
  const isEndChainageEditable = isFieldEditable('EndChainage');
  const isStartXEditable = isFieldEditable('StartX');
  const isStartYEditable = isFieldEditable('StartY');
  const isEndXEditable = isFieldEditable('EndX');
  const isEndYEditable = isFieldEditable('EndY');
  const isLengthEditable = isFieldEditable('Length');

  // Helper function to get target unit name from workTypeId when targetUnit prop is empty
  const getTargetUnitName = (workTypeId: number): string => {
    if (targetUnit) return targetUnit; // Use prop if available
    const targetUnitData = dropDowns?.find(option => option.Enum === workTypeId);
    return targetUnitData?.Measure?.toString() || '';
  };

  // Get the actual target unit to use throughout the component
  const actualTargetUnit = getTargetUnitName(workTypeId);

  // Helper function to check if a measure is length-based
  const isLengthBasedMeasure = (measure: string): boolean => {
    if (!measure) return false;
    const normalizedMeasure = measure.toLowerCase();
    return unitTypeMap[normalizedMeasure] === 'LENGTH';
  };
  
  // Helper function to determine if Length field should be required
  const isLengthRequired = (): boolean => {
    if (isRoadType()) return true; // National road always requires length
    return isLengthBasedMeasure(actualTargetUnit);
  };
  
  // Helper function to determine if Length field should be visible
  const shouldShowLengthField = (): boolean => {
    return true; // Always show the Length field
  };
  
  // Helper function to validate Length value
  const validateLength = (location: MajorItemLocations): { isValid: boolean; message: string } => {
    if (isRoadType()) {
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
      
      // if (maxAmount !== undefined && location.Length > maxAmount) {
      //   return { isValid: false, message: `Length must not exceed ${maxAmount}` };
      // }
      
      return { isValid: true, message: '' };
    }
    
    return { isValid: true, message: '' };
  };

  // Determine if we need to show the infrastructure dialog or just a text input
  const shouldUseInfraDialog = () => {
    return !shouldAutoGenerateInfraId(infraType);
  };

  const { maxX, minX, maxY, minY } = defaultCoordinates;

  const handleAddWorkLocation = () => {
    // Generate InfraId automatically for non-selectable infrastructure types
    const autoGeneratedInfraId = shouldAutoGenerateInfraId(infraType) 
      ? generateInfraId(infraType) 
      : '';

    const newWorkLocation: MajorItemLocations = {
      Id: 0, // Temporary ID
      ParentId: parentId, // Use the parentId from props (MajorItem's ReferenceId)
      StageName: programDetails?.StageName || '',
      InfraId: autoGeneratedInfraId,
      DetailedScope: '',
      TargetUnitId: workTypeId,
      TargetUnit: actualTargetUnit,
      EndChainage: 0,
      StartChainage: 0,
      StartX: 0,
      StartY: 0,
      EndX: null,
      EndY: null,
      PhysicalTarget: null,
      StartStationLimit: '',
      EndStationLimit: '',
      IsDeleted: false,
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
    
    // Check in infraData if available
    if (infraData) {
      // Check in RoadSections
      const roadSection = infraData.RoadSections?.find(road => road.RoadSectionId === infraId);
      if (roadSection) return roadSection.RoadLength?.toString() || '';
      
      // Check in Bridges
      const bridge = infraData.Bridges?.find(bridge => bridge.BridgeId === infraId);
      if (bridge) return bridge.Length?.toString() || '';
    }
    
    return '';
  };

  const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.select();
    }
  };

  // Get fields based on infrastructure type
  const getFieldsForInfraType = () => {
    if (isRoadType()) {
      // National Road: chainages + station limits
      return ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget', 'StartStationLimit', 'EndStationLimit', 'StartChainage', 'EndChainage', 'Length'];
    } else if (isBridgeType()) {
      // National Bridge: infra selection dialog, optional length
      const baseFields = ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    } else if (isLocalType()) {
      // Local infra (LR, LB, LFCS, etc.): free-text ID + coordinates, NO chainage
      const baseFields = ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget', 'StartX', 'StartY', 'EndX', 'EndY'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    } else if (infraType.toLowerCase() === 'cos' || infraType.toLowerCase() === 'ni' || infraType.toLowerCase() === 'non-infra') {
      // CoS / Non-Infra: no geo-coords
      const baseFields = ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    } else {
      // All other infra: coordinate fields
      const baseFields = ['InfraId', 'DetailedScope', 'TargetUnit', 'PhysicalTarget', 'StartX', 'StartY', 'EndX', 'EndY'];
      return shouldShowLengthField() ? [...baseFields, 'Length'] : baseFields;
    }
  };

  const renderCoordinatesRange = (coordinate: string) => {
    if (coordinate === 'X') {
      return (
        <div className="text-xs text-gray-500">
          Range: {defaultCoordinates.minX} - {defaultCoordinates.maxX}
        </div>
      )
    } else if (coordinate === 'Y') {
      return (
        <div className="text-xs text-gray-500">
          Range: {defaultCoordinates.minY} - {defaultCoordinates.maxY}
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
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(!isInfraIdEditable || disabled)}`}
                placeholder={canSelectInfra ? "Click to select infrastructure..." : canAutoGenerate ? "Auto-generated or enter custom ID..." : "Enter infrastructure ID..."}
                disabled={!isInfraIdEditable || disabled}
                readOnly={canSelectInfra}
              />
              {canSelectInfra && (
                <Button
                  color="blue"
                  onClick={() => handleEditWorkLocation(index)}
                  className={`text-sm px-3 py-2 ${getDisabledClass(!isInfraIdEditable)}`}
                  disabled={!isInfraIdEditable}
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
              )}
              {canAutoGenerate && (
                <Button
                  color="green"
                  disabled={!isInfraIdEditable || disabled}
                  onClick={() => {
                    const newId = generateInfraId(infraType);
                    handleFieldChange(index, 'InfraId', newId);
                  }}
                  className={`text-sm px-3 py-2 ${getDisabledClass(!isInfraIdEditable || disabled)}`}
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(!isDetailedScopeEditable || disabled)}`}
              placeholder="Enter detailed scope of work..."
              rows={3}
              disabled={!isDetailedScopeEditable || disabled}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 cursor-not-allowed"
              placeholder="Target unit"
              readOnly
              disabled
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(!isPhysicalTargetEditable || disabled)}`}
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
              placeholder="Enter target amount..."
              // disabled={!isPhysicalTargetEditable || disabled}
              disabled={!isPhysicalTargetEditable} // || disabled
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(!isStartStationLimitEditable || disabled)}`}
              placeholder="Start station..."
              disabled={!isStartStationLimitEditable || disabled}
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${getDisabledClass(!isEndStationLimitEditable || disabled)}`}
              placeholder="End station..."
              disabled={!isEndStationLimitEditable || disabled}
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
              value={location.EndChainage}
              onFocus={handleNumberFocus}
              onChange={(e) => handleFieldChange(index, 'EndChainage', Number(e.target.value))}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${getDisabledClass(!isEndChainageEditable || disabled)}`}
              placeholder="To..."
              disabled={!isEndChainageEditable || disabled}
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
              value={location.StartChainage}
              onFocus={handleNumberFocus}
              onChange={(e) => handleFieldChange(index, 'StartChainage', Number(e.target.value))}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${getDisabledClass(!isStartChainageEditable || disabled)}`}  
              placeholder="From..."
              disabled={!isStartChainageEditable || disabled}
            />
          </div>
        );

      case 'StartX': {
        const startXVal = Number(location.StartX);
        const startXOutOfRange = location.StartX !== null && location.StartX !== undefined && location.StartX !== 0 && (startXVal < minX || startXVal > maxX);
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start X Coordinate
            </label>
            <input
              type="number"
              value={location.StartX}
              onChange={(e) => handleFieldChange(index, 'StartX', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${startXOutOfRange ? 'border-red-500 bg-red-50' : 'border-gray-300'} ${getDisabledClass(!isStartXEditable || disabled)}`}
              placeholder="Start X coordinate..."
              min={minX}
              max={maxX}
              disabled={!isStartXEditable || disabled}
            />
            {startXOutOfRange && (
              <div className="text-xs text-red-600 flex items-start gap-1">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Value must be between {minX.toFixed(4)} and {maxX.toFixed(4)}</span>
              </div>
            )}
            {renderCoordinatesRange('X')}
          </div>
        );
      }

      case 'StartY': {
        const startYVal = Number(location.StartY);
        const startYOutOfRange = location.StartY !== null && location.StartY !== undefined && location.StartY !== 0 && (startYVal < minY || startYVal > maxY);
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Y Coordinate
            </label>
            <input
              type="number"
              value={location.StartY}
              onChange={(e) => handleFieldChange(index, 'StartY', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${startYOutOfRange ? 'border-red-500 bg-red-50' : 'border-gray-300'} ${getDisabledClass(!isStartYEditable || disabled)}`}
              placeholder="Start Y coordinate..."
              min={minY}
              max={maxY}
              disabled={!isStartYEditable || disabled}
            />
            {startYOutOfRange && (
              <div className="text-xs text-red-600 flex items-start gap-1">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Value must be between {minY.toFixed(4)} and {maxY.toFixed(4)}</span>
              </div>
            )}
            {renderCoordinatesRange('Y')}
          </div>
        );
      }

      case 'EndX': {
        const endXVal = Number(location.EndX);
        const endXOutOfRange = location.EndX !== null && location.EndX !== undefined && location.EndX !== 0 && (endXVal < minX || endXVal > maxX);
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End X Coordinate <span className="text-xs text-gray-500">(Optional for point features)</span>
            </label>
            <input
              type="number"
              value={location.EndX || ''}
              onChange={(e) => handleFieldChange(index, 'EndX', e.target.value ? Number(e.target.value) : null)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${endXOutOfRange ? 'border-red-500 bg-red-50' : 'border-gray-300'} ${getDisabledClass(!isEndXEditable || disabled)}`}
              placeholder="End X coordinate (leave empty for point)..."
              min={minX}
              max={maxX}
              disabled={!isEndXEditable || disabled}
            />
            {endXOutOfRange && (
              <div className="text-xs text-red-600 flex items-start gap-1">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Value must be between {minX.toFixed(4)} and {maxX.toFixed(4)}</span>
              </div>
            )}
            {renderCoordinatesRange('X')}
          </div>
        );
      }

      case 'EndY': {
        const endYVal = Number(location.EndY);
        const endYOutOfRange = location.EndY !== null && location.EndY !== undefined && location.EndY !== 0 && (endYVal < minY || endYVal > maxY);
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Y Coordinate <span className="text-xs text-gray-500">(Optional for point features)</span>
            </label>
            <input
              type="number"
              value={location.EndY || ''}
              onChange={(e) => handleFieldChange(index, 'EndY', e.target.value ? Number(e.target.value) : null)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${endYOutOfRange ? 'border-red-500 bg-red-50' : 'border-gray-300'} ${getDisabledClass(!isEndYEditable || disabled)}`}
              placeholder="End Y coordinate (leave empty for point)..."
              min={minY}
              max={maxY}
              disabled={!isEndYEditable || disabled}
            />
            {endYOutOfRange && (
              <div className="text-xs text-red-600 flex items-start gap-1">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Value must be between {minY.toFixed(4)} and {maxY.toFixed(4)}</span>
              </div>
            )}
            {renderCoordinatesRange('Y')}
          </div>
        );
      }

      case 'Length': {
        const isRoads = isRoadType();
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
                  <span>Auto-calculated: {absoluteDifference.toFixed(3)} m from chainages</span>
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
          // For non-Roads: Simple numeric input (no min/max constraints)
          const displayLength = location.Length !== null && location.Length !== undefined ? location.Length.toString() : '';
          const hasError = !validation.isValid && displayLength !== '';
          const isRequired = isLengthRequired();
          
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-900">
                Length (Lineal meters) {isRequired && <span className="text-red-500">*</span>}
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
                  min={0.001}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${
                    hasError ? 'border-red-500' : 'border-gray-300'
                  } ${getDisabledClass(!isLengthEditable || disabled)}`}
                  placeholder="Enter length in Lineal meters"
                  disabled={!isLengthEditable || disabled}
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
            </div>
          );
        }
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
      </div>

      {workLocations.length > 0 ? (
        
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
                  <div className="flex gap-2">
                    <Button
                      color="blue"
                      onClick={() => handleCopyWorkLocation(index)}
                      className={`flex items-center px-3 py-1 text-xs ${getDisabledClass(disabled)}`}
                      disabled={disabled}
                      title="Copy this work location"
                    >
                      <DocumentDuplicateIcon className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      color="red"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!disabled) {
                          openDeleteDialog(location, index);
                        }
                      }}
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
                      <strong>Other Infrastructure:</strong> Use coordinate fields to define precise location boundaries.
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
          deo={deo}
          mode="add"
        />
      )}
      
      {/* Delete Work Location Confirmation Dialog */}
      <DeleteWorkLocationDialog
        onConfirmDelete={onDelete}
        infraType={infraType}
      />
    </div>
  );
};

export default WorkLocationTable;
