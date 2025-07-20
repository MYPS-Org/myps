import React from "react";
import type { MajorItemOfWork, ComponentCost } from '../Model.d';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';

interface MajorItemOfWorksFormProps {
  majorItems: MajorItemOfWork[];
  componentCosts: ComponentCost[];
  onAdd: () => void;
  onEdit: (index: number, updatedItem: MajorItemOfWork) => void;
  onDelete: (index: number) => void;
}

const MajorItemOfWorksForm: React.FC<MajorItemOfWorksFormProps> = ({ 
  majorItems, 
  componentCosts, 
  onAdd, 
  onEdit, 
  onDelete 
}) => {
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
                    onChange={(e) => onEdit(index, { ...item, ComponentId: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="">Select Component</option>
                    {componentCosts.map(cost => (
                      <option key={cost.Id} value={cost.Id}>{cost.Id}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={item.YearOfWork}
                    onChange={(e) => onEdit(index, { ...item, YearOfWork: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.TypeOfWork}
                    onChange={(e) => onEdit(index, { ...item, TypeOfWork: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter type of work"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.TargetUnit}
                    onChange={(e) => onEdit(index, { ...item, TargetUnit: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter target unit"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.PhysicalTarget}
                    onChange={(e) => onEdit(index, { ...item, PhysicalTarget: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter physical target"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.DetailedScopeOfWork}
                    onChange={(e) => onEdit(index, { ...item, DetailedScopeOfWork: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter detailed scope"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="text"
                    value={item.InfraId}
                    onChange={(e) => onEdit(index, { ...item, InfraId: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Enter infra ID"
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

export default MajorItemOfWorksForm;