import React, { useState } from "react";
import type { ComponentCost, ComponentCostWithYears, ComponentCostYear } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import { ComponentCostDialog } from "../dialogs";

interface ComponentCostFormProps {
  componentCosts: ComponentCostWithYears[];
  onAdd: (cost: ComponentCost, costYear?: ComponentCostYear) => void;
  onEdit: (index: number, updatedCost: ComponentCost) => void;
  onDelete: (index: number) => void;
  initialData?: any; // Optional initial data for dropdowns or other purposes
}

const ComponentCostForm: React.FC<ComponentCostFormProps> = ({ 
  componentCosts, 
  onAdd, 
  onEdit, 
  onDelete,
  initialData
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };
    console.log('Rine => ', initialData)
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingIndex(null);
    // console.log('componentTypes:', initialData?.Dropdowns?.ComponentTypes);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (index: number) => {
    setModalMode('edit');
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const handleSaveCost = (cost: ComponentCost, costYear?: ComponentCostYear) => {
    if (modalMode === 'add') {
      onAdd(cost, costYear);
    } else if (modalMode === 'edit' && editingIndex !== null) {
      onEdit(editingIndex, cost);
      // TODO: Handle costYear updates for edit mode
    }
    handleCloseModal();
  };


  const calculateTotalCosts = () => {
    const totalCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);

    return {
      totalCost,
    };
  };

  const totalCosts = calculateTotalCosts();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Component Cost</h2>
            <Button color="blue" onClick={handleOpenAddModal}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Cost
            </Button>
        </div>

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(totalCosts.totalCost)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (2025)</div>
                <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(totalCosts.totalCost)}</div>
            </div>
        </div>

        {/* Component Cost Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Component Type</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Total Cost</TableHeader>
              <TableHeader>Created By</TableHeader>
              <TableHeader>Created Date</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {componentCosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  No component costs added yet. Click "Add Cost" to get started.
                </TableCell>
              </TableRow>
            ) : (
              componentCosts.map((cost, index) => (
                <TableRow key={cost.Id}>
                  <TableCell className="font-medium">{cost.ComponentId}</TableCell>
                  <TableCell>{cost.ComponentType}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={cost.Description}>
                      {cost.Description}
                    </div>
                  </TableCell>
                  <TableCell>₱{formatCurrency(cost.Total || 0)}</TableCell>
                  <TableCell>{cost.CreatedBy || '-'}</TableCell>
                  <TableCell>{cost.CreatedDate ? new Date(cost.CreatedDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(index)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(index)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Dialog */}
        <ComponentCostDialog
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveCost}
          editingCost={editingIndex !== null ? componentCosts[editingIndex] : undefined}
          mode={modalMode}
          componentTypes={initialData?.Dropdowns?.ComponentTypes}
          componentCosts={componentCosts}
        />
      </div>
  );
};

export default ComponentCostForm;
