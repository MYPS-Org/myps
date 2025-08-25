import React, { useState } from 'react';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '../../../components/tailwindui/table';
import AddInfraDialog from '../dialogs/AddInfraDialog';
import { mockInfraData } from '../dialogs/mockInfraData';
import type { workLocation, InfraData } from '../Model';

interface WorkLocationTableProps {
  workLocations: workLocation[];
  onAdd: (workLocation: workLocation) => void;
  onEdit: (index: number, workLocation: workLocation) => void;
  onDelete: (index: number) => void;
  infraData?: InfraData;
  workTypeId: number;
  targetUnit: string;
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
  maxAmount,
  minAmount
}) => {
  const [infraDialogOpen, setInfraDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleAddWorkLocation = () => {
    setIsAddingNew(true);
    setEditingIndex(null);
    setInfraDialogOpen(true);
  };

  const handleEditWorkLocation = (index: number) => {
    setIsAddingNew(false);
    setEditingIndex(index);
    setInfraDialogOpen(true);
  };

  const handleInfraSelect = (infraId: string, _infraName: string, _infraType: string) => {
    if (isAddingNew) {
      // Create new work location
      const newWorkLocation: workLocation = {
        InfraId: infraId,
        DetailedScope: '',
        TargetUnitId: workTypeId,
        TargetUnit: targetUnit,
        StartX: 0,
        StartY: 0,
        EndX: 0,
        EndY: 0,
        TargetAmount: 0,
        StartStationLimit: 0,
        EndStationLimit: 0,
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

  const handleFieldChange = (index: number, field: keyof workLocation, value: any) => {
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

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-700">Work Locations</h4>
        <Button
          color="blue"
          onClick={handleAddWorkLocation}
          className="text-xs px-2 py-1"
        >
          <PlusIcon className="w-3 h-3 mr-1" />
          Add Location
        </Button>
      </div>

      {workLocations.length > 0 ? (
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="min-w-[100px]">Infra ID</TableHeader>
                <TableHeader className="min-w-[80px]">Length</TableHeader>
                <TableHeader className="min-w-[120px]">Detailed Scope</TableHeader>
                <TableHeader className="min-w-[80px]">Target Unit</TableHeader>
                <TableHeader className="min-w-[100px]">Physical Target</TableHeader>
                <TableHeader className="min-w-[80px]">Start Station</TableHeader>
                <TableHeader className="min-w-[80px]">End Station</TableHeader>
                <TableHeader className="min-w-[60px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {workLocations.map((location, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={location.InfraId}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Select..."
                        readOnly
                      />
                      <Button
                        color="blue"
                        onClick={() => handleEditWorkLocation(index)}
                        className="text-xs px-1 py-1"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      value={getInfraLength(location.InfraId)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Length"
                      readOnly
                    />
                  </TableCell>
                  <TableCell>
                    <textarea
                      value={location.DetailedScope}
                      onChange={(e) => handleFieldChange(index, 'DetailedScope', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Enter scope"
                      rows={1}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      value={targetUnit}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Target unit"
                      readOnly
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      value={location.TargetAmount}
                      onChange={(e) => handleFieldChange(index, 'TargetAmount', Number(e.target.value))}
                      onFocus={handleNumberFocus}
                      max={maxAmount}
                      min={minAmount}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      value={location.StartStationLimit}
                      onChange={(e) => handleFieldChange(index, 'StartStationLimit', Number(e.target.value))}
                      onFocus={handleNumberFocus}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Start"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      value={location.EndStationLimit}
                      onChange={(e) => handleFieldChange(index, 'EndStationLimit', Number(e.target.value))}
                      onFocus={handleNumberFocus}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500"
                      placeholder="End"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      color="red"
                      onClick={() => onDelete(index)}
                      className="text-xs px-1 py-1"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 rounded-md p-4 text-center">
          <p className="text-sm text-gray-500">No work locations added yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Location" to get started.</p>
        </div>
      )}

      {/* Add Infrastructure Dialog */}
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
    </div>
  );
};

export default WorkLocationTable;
