import React from "react";
import type { FundingProfile, ProjectFormPayload } from "../Model";
import { Button } from "../../../components/tailwindui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../components/tailwindui/table";

interface FundingProfileFormProps {
  initialData?: ProjectFormPayload;
  fundingProfiles: FundingProfile[];
  onAdd: () => void;
  onEdit: (index: number, updatedProfile: FundingProfile) => void;
  onDelete: (index: number) => void;
}

const FundingProfileForm: React.FC<FundingProfileFormProps> = ({ 
  fundingProfiles, 
  onAdd, 
  onEdit, 
  onDelete,
  initialData
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Funding Profile</h2>
        <Button color="blue" onClick={onAdd}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Funding
        </Button>
        </div>

        <Table>
        <TableHead>
            <TableRow>
            <TableHeader>Source</TableHeader>
            <TableHeader>Agreement</TableHeader>
            <TableHeader>Percentage</TableHeader>
            <TableHeader>Actions</TableHeader>
            </TableRow>
        </TableHead>
        <TableBody>
            {fundingProfiles.map((profile, index) => (
            <TableRow key={profile.Id}>
                <TableCell>
                  <select
                    name="source"
                    value={profile.Source}
                    onChange={(e) => onEdit(index, { ...profile, Source: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="">Select Source</option>
                    {initialData?.Dropdowns?.Sources?.map((source) => (
                      <option key={source.Id} value={source.SourceId}>
                        {source.Name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    name="agreement"
                    value={profile.Agreement}
                    onChange={(e) => onEdit(index, { ...profile, Agreement: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="">Select Agreement</option>
                    {initialData?.Dropdowns?.Agreements?.map((agreement) => (
                      <option key={agreement.Id} value={agreement.AgreementId}>
                        {agreement.Name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <input
                    type="number"
                    value={profile.Percentage}
                    onChange={(e) => onEdit(index, { ...profile, Percentage: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="0"
                    min="0"
                    max="100"
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

export default FundingProfileForm;