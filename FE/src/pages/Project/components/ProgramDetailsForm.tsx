import { useState } from "react";
import type { ProgramDetails } from "../Model";
import { searchProgram } from "../Service";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";

interface ProgramDetailsFormProps {
  programDetails: ProgramDetails;
  setProgramDetails: React.Dispatch<React.SetStateAction<ProgramDetails>>;
  onChange?: (updatedDetails: ProgramDetails) => void;
  mode?: 'add' | 'edit';
}

const ProgramDetailsForm: React.FC<ProgramDetailsFormProps> = ({
  programDetails,
  setProgramDetails,
  onChange,
  mode = 'add',
}) => {
  const [searchFormData, setSearchFormData] = useState({ programName: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (programName: string) => {
    setIsLoading(true);
    try {
      const response = await searchProgram(programName);
      setProgramDetails(response.Data);
      onChange?.(response.Data);
    } catch (error) {
      console.error("Error fetching program details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setSearchFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-left text-lg font-semibold text-gray-900 mb-4">Program Details</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">

            {mode === 'add' ? (
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                Program Name
                </label>
                <div className='flex items-center overflow-hidden border border-gray-300 rounded-md shadow-sm'>
                <input
                    type="text"
                    value={searchFormData.programName}
                    onChange={(e) => handleInputChange('programName', e.target.value)}
                    className="w-full px-3 py-2"
                    placeholder='Enter program name'
                    required
                />
                <button
                    type="button"
                    onClick={() => handleSearch(searchFormData.programName)}
                    className="px-3 py-2.5 bg-gray-500 text-white hover:bg-gray-600"
                >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                </button>
                </div>
                {isLoading && <p className="text-sm text-blue-600 mt-1">Loading program details...</p>}
            </div>
            ) : (
            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program Name:</label>
                <input
                type="text"
                value={programDetails.ProgramName}
                disabled
                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
                />
            </div>
            )}

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program Type:</label>
                <input
                    type="text"
                    value={programDetails.ProgramType}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Start Year:</label>
                <input
                    type="number"
                    value={programDetails.StartYear}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program Stage:</label>
                <input
                    type="text"
                    value={programDetails.ProgramStage}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">User Group:</label>
                <input
                    type="text"
                    value={programDetails.UserGroup}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
            <label className="flex-1/3 text-gray-600">Data Security:</label>
            <input
                type="number"
                value={programDetails.DataSecurity}
                disabled={mode === 'edit'}
                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
            />
            </div>
        </div>
    </div>
  );
};

export default ProgramDetailsForm;
