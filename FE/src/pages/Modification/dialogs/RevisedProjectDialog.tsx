import { useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { useDropDownData } from "../hooks/useDropDown";
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';

interface ReviseProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReviseProjectDialog: React.FC<ReviseProjectDialogProps> = ({ isOpen, onClose }) => {
    const {
        initializeData,
        modCategories,
        modReasons
    } = useDropDownData();

    useEffect(() => {
        initializeData();
    }, [initializeData]);

    const handleSubmit = () => {
        console.log('Submit revised project');
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl p-6">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <DialogTitle className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center">
                            Modify Project
                        </DialogTitle>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className='flex'>
                            <label className='block text-sm font-medium text-gray-700 mb-2'>
                                Revision Type
                            </label>
                            <select className='ml-4 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                                {modCategories.map((category) => (
                                    <option key={category.Id} value={category.CodeGroup}>
                                        {category.CodeDescription}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </form>
            </DialogPanel>
            </div>
        </Dialog>
    );
}
export default ReviseProjectDialog;