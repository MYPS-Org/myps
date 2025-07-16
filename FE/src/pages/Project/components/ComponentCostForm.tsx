import { useState } from "react";
import type { ComponentCost } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";


interface ComponentCostFormProps {
  initialData?: ComponentCost;
  onSubmit: (data: ComponentCost) => void;
}

const ComponentCostForm: React.FC<ComponentCostFormProps> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<ComponentCost>(initialData || {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Component Cost</h2>
            <Button color="blue">
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Cost
            </Button>
        </div>

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCost)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (CW1)</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCostCw1)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (CW2)</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCostCw2)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (2025)</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCost2025)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (2026)</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCost2026)}</div>
            </div>
        </div>

        {/* Component Cost Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Actions</TableHeader>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>2025</TableHeader>
              <TableHeader>2026</TableHeader>
              <TableHeader>MYCA Approval</TableHeader>
              <TableHeader>UACs PAP Code</TableHeader>
              <TableHeader>Planned Start Date</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {componentCosts.map(cost => (
              <TableRow key={cost.Id}>
                <TableCell>
                  <div className="flex space-x-1">
                    <button className="text-blue-600 hover:text-blue-800">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>{cost.Id}</TableCell>
                <TableCell>{cost.Description}</TableCell>
                <TableCell className="text-right">{formatCurrency(cost.Cost2025)}</TableCell>
                <TableCell className="text-right">{formatCurrency(cost.Cost2026)}</TableCell>
                <TableCell>{cost.MYCAApproval}</TableCell>
                <TableCell>{cost.UACsPAPCode}</TableCell>
                <TableCell>{cost.PlannedStartDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  );
};

export default ComponentCostForm;
