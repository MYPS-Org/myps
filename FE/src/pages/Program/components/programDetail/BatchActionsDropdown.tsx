import React, { useState } from 'react';
import { ChevronDownIcon, TagIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { batchAllowPublishing, batchDeleteProjects, batchRestrictPublishing } from '../../Service';
import BatchTagDialog from '../../dialogs/BatchTagDialog';

interface BatchActionsDropdownProps {
  programId: string;
  programName: string;
  isActive: boolean;
  isTerminalStage: boolean;
  defaultStatus: number;
  /** Told which action just ran: only a delete removes rows, so only it resets the table to page 1. */
  onRefresh: (action: 'tag' | 'delete' | 'unpublish' | 'publish') => Promise<void>;
  onLoadingChange: (loading: boolean) => void;
}

const BatchActionsDropdown: React.FC<BatchActionsDropdownProps> = ({
  programId,
  programName,
  isActive,
  isTerminalStage,
  defaultStatus,
  onRefresh,
  onLoadingChange,
}) => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<'tag' | 'delete' | 'unpublish' | 'publish'>('tag');

  const handleBatchTagging = (action: 'tag' | 'delete' | 'unpublish' | 'publish' = 'tag') => {
    setBatchAction(action);
    setIsDialogOpen(true);
    setIsOpen(false);
  };

  const handleBatchTagSubmit = async (pid: string, projectIds: string, action: 'tag' | 'delete' | 'unpublish' | 'publish') => {
    try {
      onLoadingChange(true);
      switch (action) {
        case 'delete': {
          const response = await batchDeleteProjects({ ProgramId: pid, ProjectIds: projectIds });
          showToast({ type: 'success', message: response.Data.Message });
          break;
        }
        case 'unpublish': {
          const response = await batchRestrictPublishing({ ProgramId: pid, ProjectIds: projectIds });
          showToast({ type: 'success', message: response.Data.Message });
          break;
        }
        case 'publish': {
          const response = await batchAllowPublishing({ ProgramId: pid, ProjectIds: projectIds });
          showToast({ type: 'success', message: response.Data.Message });
          break;
        }
        default:
          showToast({ type: 'success', message: 'Tags applied successfully to all projects.' });
      }
      await onRefresh(action);
    } catch (error) {
      console.error(`Error performing batch ${action}:`, error);
      // httpClient's interceptor toasts the API's own message (e.g. which project IDs were not
      // found) and then rethrows it as an ErrorResponse carrying that Message; a second toast
      // would only hide that reason. It toasts nothing for a network error or a 401/403/500
      // without a Message body, and rethrows the raw error, so without this the user saw no
      // feedback at all.
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: `Failed to ${action} projects. Please try again.` });
      }
    } finally {
      onLoadingChange(false);
    }
  };

  const showPublishActions = isActive && isTerminalStage && defaultStatus === 1;

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-100 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <TagIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
          Batch Actions
          <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

            {/* Batch Actions Menu */}
            <div className="absolute left-0 top-full z-20 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1">
                <button
                  onClick={() => handleBatchTagging('delete')}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-red-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Batch Delete
                </button>
                {showPublishActions && (
                  <>
                    <button
                      onClick={() => handleBatchTagging('unpublish')}
                      className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-500 hover:text-white"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                      Restrict Publishing
                    </button>
                    <button
                      onClick={() => handleBatchTagging('publish')}
                      className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-green-500 hover:text-white"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Allow Publishing
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {isDialogOpen && (
        <BatchTagDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={handleBatchTagSubmit}
          programId={programId}
          programName={programName}
          action={batchAction}
        />
      )}
    </>
  );
};

export default BatchActionsDropdown;
