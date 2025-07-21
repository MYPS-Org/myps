import { useState } from "react";
import type { ProgramDetails, ProjectEnums } from "../Model";
import { searchProgram } from "../Service";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";

interface ProgramDetailsFormProps {
  programDetails: ProgramDetails;
  setProgramDetails: React.Dispatch<React.SetStateAction<ProgramDetails>>;
  onChange?: (updatedDetails: ProgramDetails) => void;
  mode?: 'add' | 'edit';
  projectEnums?: ProjectEnums;
}

const ProgramDetailsForm: React.FC<ProgramDetailsFormProps> = ({
  programDetails,
  setProgramDetails,
  onChange,
  mode = 'add',
  projectEnums 
}) => {
  const [searchFormData, setSearchFormData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

const setProgram = (value: string) => {
  console.log('Selected program value:', value);
    const selectedProgram = projectEnums?.Programs?.find(
      program => program.ProgramId === value
    );
  console.log(projectEnums?.Programs);
    if(!selectedProgram) {
      // Clear the program details if no program is selected
      const emptyProgramDetails: ProgramDetails = {
        Id: 0,
        ProgramId: '',
        RevisionNumber: 0,
        Name: '',
        StageId: 0,
        StageName: '',
        UserGroup: 0,
        RegionCode: '',
        Status: 0,
        Type: 0,
        Cost: 0,
        YearStart: 0,
        YearEnd: 0,
        CreatedBy: '',
        CreatedDate: '',
        UpdatedBy: '',
        UpdatedDate: '',
      };
      setProgramDetails(emptyProgramDetails);
      setSearchFormData('');
      return;
    }
    onChange?.(selectedProgram as ProgramDetails);
    setSearchFormData(selectedProgram!.ProgramId);
    setProgramDetails(selectedProgram as ProgramDetails);
}
  // const handleSearch = async (programName: string) => {
  //   setIsLoading(true);
  //   try {
  //     const response = await searchProgram(programName);
  //     setProgramDetails(response.Data);
  //     onChange?.(response.Data);
  //   } catch (error) {
  //     console.error("Error fetching program details:", error);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };


  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-left text-lg font-semibold text-gray-900 mb-4">Program Details</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">

            {mode === 'add' ? (
            <div className="w-full flex flex-row text-left gap-5 items-center">
                  <div className='w-full flex flex-row text-left gap-5 items-center'>
                    <label className="w-1/3 text-gray-600">Program Id</label>
                    <select
                      value={searchFormData}
                      onChange={(e) => setProgram(e.target.value)}
                      className='w-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md truncate'
                      disabled={mode !== 'add'}
                      style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    >
                      <option value="">Select Program</option>
                      {projectEnums?.Programs?.map((program) => (
                        <option key={program.Id} value={program.ProgramId}>
                          {program.Name}
                        </option>
                      ))}
                    </select>
                </div>
                {isLoading && <p className="text-sm text-blue-600 mt-1">Loading program details...</p>}
            </div>
            ) : (
            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program ID:</label>
                <input
                type="text"
                value={programDetails.ProgramId || ''}
                disabled
                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
                />
            </div>
            )}

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program Name:</label>
                <input
                type="text"
                value={programDetails.Name || ''}
                disabled
                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program Type:</label>
                <input
                    type="text"
                    value={programDetails.Type || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Start Year:</label>
                <input
                    type="number"
                    value={programDetails.YearStart || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Program Stage:</label>
                <input
                    type="text"
                    value={programDetails.StageName || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">User Group:</label>
                <input
                    type="text"
                    value={programDetails.UserGroup || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">End Year:</label>
                <input
                    type="number"
                    value={programDetails.YearEnd || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Region Code:</label>
                <input
                    type="text"
                    value={programDetails.RegionCode || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Cost:</label>
                <input
                    type="number"
                    value={programDetails.Cost || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            <div className='flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Status:</label>
                <input
                    type="text"
                    value={programDetails.Status || ''}
                    disabled={mode === 'edit'}
                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                />
            </div>

            {/* <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Data Security:</label>
              <input
                  type="number"
                  value={programDetails.DataSecurity}
                  disabled={mode === 'edit'}
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
              />
            </div> */}
        </div>
    </div>
  );
};

export default ProgramDetailsForm;
