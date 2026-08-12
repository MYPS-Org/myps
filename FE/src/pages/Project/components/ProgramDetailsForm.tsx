import { useState, useEffect } from "react";
import SearchableDropdown from "../../../components/ui/SearchableDropdown";
import { formatDropdownOptions } from "../../../utils/GlobalFunctions";
import type { ProgramLatest } from "../../Program/Model";
import { searchProgram } from "../Service";

interface ProgramDetailsFormProps {
  initialData?: any;
  programDetails: ProgramLatest;
  setProgramDetails: React.Dispatch<React.SetStateAction<ProgramLatest>>;
  onChange?: (updatedDetails: ProgramLatest) => void;
  mode?: 'add' | 'edit';
  initialStageName?: string;
  initialProgramPK?: string;
}

const emptyProgramDetails: ProgramLatest = {
  Id: 0,
  RevisionId: 0,
  StageFKId: 0,
  ProgramPK: '',
  ProgramId: '',
  StageId: 0,
  StageName: '',
  Name: '',
  Status: undefined,
  Type: '',
  DataSecurityGroup: '',
  UserGroup: '',
  StartYear: 0,
  YearEnd: 0,
};

const ProgramDetailsForm: React.FC<ProgramDetailsFormProps> = ({
  programDetails,
  setProgramDetails,
  onChange,
  mode = 'add',
  initialStageName,
  initialProgramPK
}) => {
  const [programs, setPrograms] = useState<ProgramLatest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load programs from /Program/ShowProgram as soon as the form mounts in add mode
  useEffect(() => {
    if (mode !== 'add') return;
    let cancelled = false;
    setIsLoading(true);
    searchProgram('')
      .then((response) => {
        if (cancelled) return;
        const results = (response.Data.Programs || []).filter((program) => {
          // Filter out GAA-R programs
          if (program.StageName === 'GAA-R') return false;
          // If initialStageName is provided, only show programs with matching stageName
          if (initialStageName && program.StageName !== initialStageName) return false;
          return true;
        });
        setPrograms(results);

        // Pre-select the program we arrived with (e.g. "Add Project" from a Program's detail page).
        // ProjectForm can't do this itself: /Project/ShowProjectComponentDropdowns doesn't return a
        // Programs list, so this component's own searchProgram() call is the only source of it.
        if (initialProgramPK) {
          const preselected = results.find(program => program.ProgramPK === initialProgramPK);
          if (preselected) {
            setProgramDetails(preselected);
            onChange?.(preselected);
          }
        }
      })
      .catch((error) => {
        console.error('Error loading programs:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // onChange/setProgramDetails intentionally omitted: parent passes a fresh onChange each render,
    // and re-running this fetch on every parent render would spam /Program/ShowProgram.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialStageName, initialProgramPK]);

  const setProgram = (value: string | number) => {
    const selectedProgram = programs.find(program => program.ProgramId === value);
    if (!selectedProgram) {
      setProgramDetails(emptyProgramDetails);
      return;
    }
    onChange?.(selectedProgram);
    setProgramDetails(selectedProgram);
  }
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-3 gap-4 text-sm">

          {mode === 'add' ? (
          <div className="w-full flex flex-row text-left gap-5 items-center">
                <div className='w-full flex flex-row text-left gap-5 items-center'>
                  <label className="w-1/3 text-gray-600">Program Name</label>
                  <div className="w-2/3 min-w-0">
                    <SearchableDropdown
                      options={formatDropdownOptions(programs, 'ProgramId', 'Name', 'Id')}
                      value={programDetails?.ProgramId || ''}
                      onChange={setProgram}
                      placeholder={isLoading ? 'Loading programs...' : 'Select Program'}
                      searchPlaceholder="Search program..."
                      disabled={isLoading}
                      allowClear
                    />
                  </div>
              </div>
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
                  value={programDetails.ProgramType || programDetails.Type || ''}
                  disabled={mode === 'edit'}
                  readOnly
                  className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
              />
          </div>

          <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Start Year:</label>
              <input
                  type="number"
                  value={programDetails.StartYear || ''}
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
