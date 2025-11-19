import { useState, useEffect } from "react";
import type { ProjectEnums } from "../../../Project/Model.d";
import type { ProgramList } from "../../../Program/Model.d";

interface ProgramDetailsFormProps {
  initialData?: any;
  programDetails: ProgramList;
  setProgramDetails: React.Dispatch<React.SetStateAction<ProgramList>>;
  onChange?: (updatedDetails: ProgramList) => void;
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
  const [isLoading] = useState(false);

  // Update searchFormData when programDetails changes
  useEffect(() => {
    if (programDetails?.ProgramId) {
      setSearchFormData(programDetails.ProgramId);
    }
  }, [programDetails?.ProgramId]);

  const setProgram = (value: string) => {
    console.log('Selected program value:', value);
      const selectedProgram = projectEnums?.Programs?.find(
        program => program.ProgramId === value
      );
      console.log(projectEnums?.Programs);
      if(!selectedProgram) {
        // Clear the program details if no program is selected
        const emptyProgramDetails: ProgramList = {
        Id: 0,
        RevisionId: 0,
        ProgramId: '',
        StageName: '',
        Name: '',
        GroupName: '',
        RegionCode: '',
        Status: '',
        Type: '',
        Cost: 0,
        YearStart: 0,
        YearEnd: 0,
        CreatedBy: '',
        CreatedDate: '',
        IsPublished: false,
        };
        setProgramDetails(emptyProgramDetails);
        setSearchFormData('');
        return;
      }
      onChange?.(selectedProgram as ProgramList);
      setSearchFormData(selectedProgram!.ProgramId);
      setProgramDetails(selectedProgram as ProgramList);
  }
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-3 gap-4 text-sm">

          {mode === 'add' ? (
          <div className="w-full flex flex-row text-left gap-5 items-center">
                <div className='w-full flex flex-row text-left gap-5 items-center'>
                  <label className="w-1/3 text-gray-600">Program Name</label>
                  <select
                    value={searchFormData}
                    onChange={(e) => setProgram(e.target.value)}
                    className='w-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md truncate'
                    disabled={mode !== 'add'}
                    style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                  >
                    <option value="">Select Program</option>
                    {projectEnums?.Programs?.filter((program ) => (program.StageName !== 'GAA-R')).map((program) => (
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
              <label className="flex-1/3 text-gray-600">Program Name:</label>
              <input
              type="text"
              value={programDetails.Name || ''}
              readOnly
              className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
              />
          </div>
          )}

          <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Program Type:</label>
              <input
                  type="text"
                  value={programDetails.TypeName || ''}
                  disabled={mode === 'edit'}
                  readOnly
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
              />
          </div>

          <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Start Year:</label>
              <input
                  type="number"
                  value={programDetails.YearStart || ''}
                  disabled={mode === 'edit'}
                  readOnly
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
              />
          </div>

          <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Program Stage:</label>
              <input
                  type="text"
                  value={programDetails.StageName || ''}
                  disabled={mode === 'edit'}
                  readOnly
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
              />
          </div>

          {/* <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">User Group:</label>
              <input
                  type="text"
                  value={programDetails.GroupName || ''}
                  disabled={mode === 'edit'}
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                  readOnly
              />
          </div> */}

          {/* <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Data Security:</label>
              <input
                  type="text"
                  value={programDetails.RegionCode || ''}
                  disabled={mode === 'edit'}
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                  readOnly
              />
          </div> */}
      </div>
    </div>
  );
};

export default ProgramDetailsForm;
