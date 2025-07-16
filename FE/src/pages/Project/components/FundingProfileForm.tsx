import { useState } from "react";
import type { FundingProfile } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";

interface FundingProfileFormProps {
  initialData?: FundingProfile;
  onSubmit: (data: FundingProfile) => void;
}

const FundingProfileForm: React.FC<FundingProfileFormProps> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<FundingProfile>(initialData || {});

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
        <h2 className="text-lg font-semibold text-gray-900">Funding Profile</h2>
        <Button color="blue">
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Funding Profile
        </Button>
        </div>

        <Table>
        <TableHead>
            <TableRow>
            <TableHeader>Actions</TableHeader>
            <TableHeader>Source</TableHeader>
            <TableHeader>Agreement</TableHeader>
            <TableHeader>Percentage</TableHeader>
            </TableRow>
        </TableHead>
        <TableBody>
            {fundingProfiles.map(funding => (
            <TableRow key={funding.Id}>
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
                <TableCell>{funding.Source}</TableCell>
                <TableCell>{funding.Agreement}</TableCell>
                <TableCell>{funding.Percentage}%</TableCell>
            </TableRow>
            ))}
        </TableBody>
        </Table>
    </div>
  );
};

export default FundingProfileForm;