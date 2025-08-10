import React, { useState, useEffect } from "react";
import type { MajorItemOfWork, ComponentCost, InfraData, ScopeOfWorkEnum } from '../Model.d';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import AddInfraDialog from '../dialogs/AddInfraDialog';
import { mockInfraData } from "../dialogs/mockInfraData";

interface MajorItemOfWorksFormProps {
  majorItems: MajorItemOfWork[];
  componentCosts: ComponentCost[];
  infraData?: InfraData;
  onAdd: () => void;
  onEdit: (index: number, updatedItem: MajorItemOfWork) => void;
  onDelete: (index: number) => void;
  dropDowns?: ScopeOfWorkEnum[]; // Optional initial data for dropdowns or other purposes
}

const MajorItemOfWorksForm: React.FC<MajorItemOfWorksFormProps> = ({ 
  majorItems, 
  componentCosts, 
  infraData,
  onAdd, 
  onEdit, 
  onDelete,
  dropDowns
}) => {
  const [infraDialogOpen, setInfraDialogOpen] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // Debug: Monitor when majorItems prop changes
  useEffect(() => {
    console.log('MajorItemOfWorksForm: majorItems prop changed:', majorItems);
    majorItems.forEach((item, index) => {
      console.log(`Item ${index} - TypeOfWork:`, item.WorkTypeId, typeof item.WorkTypeId);
    });
  }, [majorItems]);

  const handleInfraSelect = (infraId: string, infraName: string, infraType: string) => {
    if (selectedItemIndex !== null) {
      const updatedItem = { 
        ...majorItems[selectedItemIndex], 
        InfraId: infraId,
        // You can also store infraName and infraType if needed in your model
        Description: `${infraType}: ${infraName}` // Update description with selected infrastructure
      };
      onEdit(selectedItemIndex, updatedItem);
    }
    setInfraDialogOpen(false);
    setSelectedItemIndex(null);
  };

  // Store max/min units per row index
  const [rowUnits, setRowUnits] = useState<Record<number, { max?: number; min?: number }>>({});

  const handleChange = (index: number, field: string, value: any) => {
    console.log(`Updating field '${field}' at index ${index} with value:`, value);
    console.log('Current item before update:', majorItems[index]);
    const updatedItem = { ...majorItems[index], [field]: value };
    console.log('Updated item being sent to parent:', updatedItem);
    onEdit(index, updatedItem);
  };

  const handleTypeOfWorkChange = (index: number, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    console.log("TypeOfWork select changed - string value:", value, "number value:", numValue);
    
    // Create the updated item with both TypeOfWork and TargetUnit
    let updatedItem = { ...majorItems[index], TypeOfWork: numValue };
    
    // If we have a valid selection, also update the TargetUnit
    if (numValue > 0) {
      console.log("Looking for TypeOfWork enum:", numValue);
      const newTargetUnit = dropDowns?.find(option => option.Enum === numValue);
      if (newTargetUnit) {
        console.log("Found matching target unit:", newTargetUnit.Measure);
        updatedItem.TargetUnitId = newTargetUnit.Measure;
        
        // Update row-specific units
        setRowUnits(prev => ({
          ...prev,
          [index]: {
            max: newTargetUnit.MaxAmount,
            min: newTargetUnit.MinAmount
          }
        }));
        console.log("Setting max/min units:", { max: newTargetUnit.MaxAmount, min: newTargetUnit.MinAmount });
      } else {
        console.log("No match found for TypeOfWork value:", numValue);
        updatedItem.TargetUnitId = 0;
      }
    } else {
      // Clear target unit if no valid selection
      updatedItem.TargetUnitId = 0;
      // Clear row-specific units
      setRowUnits(prev => ({
        ...prev,
        [index]: { max: undefined, min: undefined }
      }));
    }
    
    console.log("Final updated item to send to parent:", updatedItem);
    onEdit(index, updatedItem);
  };

  const getInfraLength = (infraId: string) => {
    const data = mockInfraData;
    // if (!infraId || !infraData) return '';
    if (!infraId || !data) return '';
    console.log("Fetching length for InfraId:", infraId);
    // Check in RoadSections
    const roadSection = data.RoadSections?.find(road => road.SectionId === infraId);
    console.log("Found RoadSection:", roadSection);
    if (roadSection) return roadSection.SectionLength?.toString() || '';
    
    // Check in Bridges
    // const bridge = infraData.Bridges?.find(bridge => bridge.BridgeId === infraId);
    const bridge = data.Bridges?.find(bridge => bridge.BridgeId === infraId);
    if (bridge) return bridge.Length?.toString() || '';
    
    // For FCS and OtherInfra, they might not have length properties
    return '';
  };

  const openInfraDialog = (index: number) => {
    setSelectedItemIndex(index);
    setInfraDialogOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Major Item of Work</h2>
          <Button color="blue" onClick={onAdd}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Item
          </Button>
        </div>

        <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="min-w-[120px]">Component ID</TableHeader>
              <TableHeader className="min-w-[100px]">Year of Work</TableHeader>
              <TableHeader className="min-w-[140px]">Type of Work</TableHeader>
              <TableHeader className="min-w-[100px]">Target Unit</TableHeader>
              <TableHeader className="min-w-[120px]">Physical Target</TableHeader>
              <TableHeader className="min-w-[120px]">Detailed Scope</TableHeader>
              <TableHeader className="min-w-[100px]">Infra ID</TableHeader>
              <TableHeader className="min-w-[80px]">Length</TableHeader>
              <TableHeader className="min-w-[80px]">Start Station</TableHeader>
              <TableHeader className="min-w-[80px]">End Station</TableHeader>
              <TableHeader className="min-w-[80px]">Start From</TableHeader>
              <TableHeader className="min-w-[80px]">End From</TableHeader>
              <TableHeader className="min-w-[80px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {majorItems.map((item, index) => {
              console.log(`Row ${index} - WorkTypeId:`, item.WorkTypeId, typeof item.WorkTypeId);
              return (
              <TableRow key={item.Id}>
                <TableCell>
                  <select
                    value={item.ComponentId}
                    onChange={(e) => handleChange(index, 'ComponentId', Number(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Select Component</option>
                    {componentCosts.map(cost => (
                      <option key={cost.Id} value={cost.Id}>{cost.ComponentId}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.YearOfWork}
                    onChange={(e) => handleChange(index, 'YearOfWork', Number(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                  />
                </TableCell>
                <TableCell className="">
                  <select name="typeOfWork" id="typeOfWork" 
                          value={item.WorkTypeId}
                          onChange={(e) => handleTypeOfWorkChange(index, e.target.value)}
                          className="max-w-sm px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500 truncate"
                          style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                          >
                    <option value="">Select Type of Work</option>
                    {dropDowns?.map(option => (
                      <option key={option.Id} value={option.Enum}>{option.Description}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.TargetUnitId}
                    onChange={(e) => handleChange(index, 'TargetUnitId', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter target unit"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.PhysicalTarget}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChange(index, 'PhysicalTarget', val === '' ? null : Number(val));
                    }}
                    max={rowUnits[index]?.max}
                    min={rowUnits[index]?.min}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    // placeholder={`Minimum ${rowUnits[index]?.min} - Maximum ${rowUnits[index]?.max}`}
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.Description}
                    onChange={(e) => handleChange(index, 'Description', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter detailed scope"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={item.InfraId}
                      onChange={(e) => handleChange(index, 'InfraId', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Enter infra ID"
                      readOnly
                    />
                    <Button
                      color="orange"
                      onClick={() => openInfraDialog(index)}
                      className="whitespace-nowrap text-xs px-2 py-1"
                    >
                      Select
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={getInfraLength(item.InfraId)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Length"
                    readOnly
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.StartStationLimit}
                    onChange={(e) => handleChange(index, 'StartStationLimit', Number(e.target.value))}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Start"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.EndStationLimi}
                    onChange={(e) => handleChange(index, 'EndStationLimi', Number(e.target.value))}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="End"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.Start}
                    onChange={(e) => handleChange(index, 'StartFrom', Number(e.target.value))}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Start"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.EndFrom}
                    onChange={(e) => handleChange(index, 'EndFrom', Number(e.target.value))}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="End"
                  />
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onDelete(index)}
                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>

        {/* Add Infrastructure Dialog */}
        <AddInfraDialog
          isOpen={infraDialogOpen}
          onClose={() => {
            setInfraDialogOpen(false);
            setSelectedItemIndex(null);
          }}
          onAdd={handleInfraSelect}
          initialData={infraData}
          mode="add"
        />
      </div>
  );
};

export default MajorItemOfWorksForm;