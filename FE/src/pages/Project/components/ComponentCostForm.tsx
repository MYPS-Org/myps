import React, { useState } from "react";
import type { ComponentCost } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";
import { ComponentCostDialog } from "../dialogs";

interface ComponentCostFormProps {
  componentCosts: ComponentCost[];
  onAdd: (cost: ComponentCost) => void;
  onEdit: (index: number, updatedCost: ComponentCost) => void;
  onDelete: (index: number) => void;
}

const ComponentCostForm: React.FC<ComponentCostFormProps> = ({ 
  componentCosts, 
  onAdd, 
  onEdit, 
  onDelete 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingIndex(null);
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

  const handleSaveCost = (cost: ComponentCost) => {
    if (modalMode === 'add') {
      onAdd(cost);
    } else if (modalMode === 'edit' && editingIndex !== null) {
      onEdit(editingIndex, cost);
    }
    handleCloseModal();
  };

  const calculateTotalCosts = () => {
    const totalCost2025 = componentCosts.reduce((sum, cost) => sum + (cost.Cost2025 || 0), 0);
    const totalCost2026 = componentCosts.reduce((sum, cost) => sum + (cost.Cost2026 || 0), 0);
    const totalCost = totalCost2025 + totalCost2026;
    
    return {
      totalCost,
      totalCost2025,
      totalCost2026
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
        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(totalCosts.totalCost)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (2025)</div>
                <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(totalCosts.totalCost2025)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (2026)</div>
                <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(totalCosts.totalCost2026)}</div>
            </div>
        </div>

        {/* Component Cost Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>ID</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Cost 2025</TableHeader>
              <TableHeader>Cost 2026</TableHeader>
              <TableHeader>MYCA Approval</TableHeader>
              <TableHeader>UACs PAP Code</TableHeader>
              <TableHeader>Planned Start Date</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {componentCosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  No component costs added yet. Click "Add Cost" to get started.
                </TableCell>
              </TableRow>
            ) : (
              componentCosts.map((cost, index) => (
                <TableRow key={cost.Id}>
                  <TableCell className="font-medium">{cost.Id}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={cost.Description}>
                      {cost.Description}
                    </div>
                  </TableCell>
                  <TableCell>₱{formatCurrency(cost.Cost2025 || 0)}</TableCell>
                  <TableCell>₱{formatCurrency(cost.Cost2026 || 0)}</TableCell>
                  <TableCell>{cost.MYCAApproval || '-'}</TableCell>
                  <TableCell>{cost.UACsPAPCode || '-'}</TableCell>
                  <TableCell>{cost.PlannedStartDate || '-'}</TableCell>
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
        />
      </div>
  );
};

export default ComponentCostForm;
