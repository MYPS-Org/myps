import React from "react";
import type { ComponentCost } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";

interface ComponentCostFormProps {
  componentCosts: ComponentCost[];
  onAdd: () => void;
  onEdit: (index: number, updatedCost: ComponentCost) => void;
  onDelete: (index: number) => void;
}

const ComponentCostForm: React.FC<ComponentCostFormProps> = ({ 
  componentCosts, 
  onAdd, 
  onEdit, 
  onDelete 
}) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
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
            <Button color="blue" onClick={onAdd}>
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
            {componentCosts.map((cost, index) => (
              <TableRow key={cost.Id}>
                <TableCell>
                  <input
                    type="text"
                    value={cost.Description}
                    onChange={(e) => onEdit(index, { ...cost, Description: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter description"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={cost.Cost2025}
                    onChange={(e) => onEdit(index, { ...cost, Cost2025: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={cost.Cost2026}
                    onChange={(e) => onEdit(index, { ...cost, Cost2026: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="date"
                    value={cost.MYCAApproval}
                    onChange={(e) => onEdit(index, { ...cost, MYCAApproval: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={cost.UACsPAPCode}
                    onChange={(e) => onEdit(index, { ...cost, UACsPAPCode: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter code"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="date"
                    value={cost.PlannedStartDate}
                    onChange={(e) => onEdit(index, { ...cost, PlannedStartDate: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onDelete(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  );
};

export default ComponentCostForm;
