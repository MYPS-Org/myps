import React, { useState } from "react";
import type { MajorItemOfWork, ComponentCost, InfraData } from '../Model.d';
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
}

const MajorItemOfWorksForm: React.FC<MajorItemOfWorksFormProps> = ({ 
  majorItems, 
  componentCosts, 
  infraData,
  onAdd, 
  onEdit, 
  onDelete 
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
                    onChange={(e) => onEdit(index, { ...item, ComponentId: Number(e.target.value) })}
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
                    onChange={(e) => onEdit(index, { ...item, YearOfWork: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.TypeOfWork}
                    onChange={(e) => onEdit(index, { ...item, TypeOfWork: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter type of work"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.TargetUnit}
                    onChange={(e) => onEdit(index, { ...item, TargetUnit: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter target unit"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.PhysicalTarget}
                    onChange={(e) => onEdit(index, { ...item, PhysicalTarget: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter physical target"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.Description}
                    onChange={(e) => onEdit(index, { ...item, Description: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter detailed scope"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={item.InfraId}
                      onChange={(e) => onEdit(index, { ...item, InfraId: e.target.value })}
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