import React, { useState } from "react";
import type { MajorItemOfWork, ComponentCost, InfraData, ScopeOfWorkEnum } from '../Model.d';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import AddInfraDialog from '../dialogs/AddInfraDialog';

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

  const [maxUnit, setMaxUnit] = useState<number | undefined>();
  const [minUnit, setMinUnit] = useState<number | undefined>();

  const handleChange = (index: number, field: string, value: any) => {
    onEdit(index, { ...majorItems[index], [field]: value });
  };

  const changeTargetUnit = (index: number, value: number) => {
    console.log("Selected TypeOfWork:", value);
    const newTargetUnit = dropDowns?.find(option => option.Enum === value);
    if (newTargetUnit) {
      setMaxUnit(newTargetUnit.MaxAmount);
      setMinUnit(newTargetUnit.MinAmount);
      console.log("Matched Target Unit:", newTargetUnit.Measure);
      handleChange(index, 'TargetUnit', newTargetUnit.Measure);
    } else {
      console.log("No match found for", value);
    }
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

        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Year of Work</TableHeader>
              <TableHeader>Type of Work</TableHeader>
              <TableHeader>Target Unit</TableHeader>
              <TableHeader>Physical Target</TableHeader>
              <TableHeader>Detailed Scope</TableHeader>
              <TableHeader>Infra ID</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {majorItems.map((item, index) => (
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
                <TableCell className="w-1/4">
                  <select name="typeOfWork" id="typeOfWork" 
                          value={item.TypeOfWork}
                          onChange={(e) => { const value = e.target.value; handleChange(index, 'TypeOfWork', value); changeTargetUnit(index, Number(value)); }}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500 truncate"
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
                    value={item.TargetUnit}
                    onChange={(e) => handleChange(index, 'TargetUnit', e.target.value)}
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
                    max={maxUnit}
                    min={minUnit}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    // placeholder={`Minimum ${minUnit} - Maximum ${maxUnit}`}
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
                  <button
                    onClick={() => onDelete(index)}
                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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