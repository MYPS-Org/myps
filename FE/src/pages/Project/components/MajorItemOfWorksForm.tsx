import { useState } from "react";
import type { MajorItemOfWork } from '../Model.d';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';

interface MajorItemOfWorksFormProps {
  initialData?: MajorItemOfWork;
  onSubmit: (data: MajorItemOfWork) => void;
}

const MajorItemOfWorksForm: React.FC<MajorItemOfWorksFormProps> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<MajorItemOfWork>(initialData || {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Major Item of Work</h2>
          <Button color="blue">
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Item
          </Button>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Actions</TableHeader>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Year of Work</TableHeader>
              <TableHeader>Type of Work</TableHeader>
              <TableHeader>Target Unit</TableHeader>
              <TableHeader>Physical Target</TableHeader>
              <TableHeader>Detailed Scope of Work</TableHeader>
              <TableHeader>Infra ID</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {majorItems.map(item => (
              <TableRow key={item.Id}>
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
                <TableCell>{item.ComponentId}</TableCell>
                <TableCell>{item.YearOfWork}</TableCell>
                <TableCell>{item.TypeOfWork}</TableCell>
                <TableCell>{item.TargetUnit}</TableCell>
                <TableCell>{item.PhysicalTarget}</TableCell>
                <TableCell>{item.DetailedScopeOfWork}</TableCell>
                <TableCell>{item.InfraId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  );
};

export default MajorItemOfWorksForm;