import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { useDropDownData } from '../hooks/useDropDown';

interface AdjustProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    revisionTypeId: number;
    revisionTypeDescription: string;
    projectId: string;
    stageName: string;
}

const AdjustProjectDialog: React.FC<AdjustProjectDialogProps> = ({ 
    isOpen, 
    onClose, 
    revisionTypeId, 
    revisionTypeDescription, 
    projectId, 
    stageName, 
}) => {

    const { initializeData, modCategories, modReasons } = useDropDownData();
    useEffect(() => {
        initializeData();
    }, []);

    const project = {
        date: new Date().toISOString().split('T')[0], // Default to today's date in YYYY-MM-DD format
        revisionType: revisionTypeDescription,
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Back Drop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-6">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Modify Project
                            </DialogTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                 {stageName} - {projectId}
                            </p>
                        </div>
                        <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 "
                        >
                        <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                    <form className="p-6 space-y-4">
                        <div className='bg-gray-50 p-4 rounded-lg space-y-2'>
                            <h4 className="text-sm font-medium text-gray-900">Project Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium text-gray-700">Project ID:</span>
                                    <p className="text-gray-600">{projectId}</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Current Revision:</span>
                                    <p className="text-gray-600">{revisionTypeDescription}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-medium text-gray-700">Stage Name:</span>
                                    <p className="text-gray-600">{stageName}</p>
                                </div>
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Revision Type :
                                </label>
                                <select 
                                    className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                    defaultValue={revisionTypeDescription}
                                >
                                    {modCategories.filter((category) => !category.Obsolete).map((category) => (
                                        <option key={category.Id} value={category.CodeGroup}>
                                            {category.CodeDescription}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Date of Approval :
                                </label>
                                <input 
                                    type="date" 
                                    defaultValue={project.date}
                                    className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                />
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Approval Document :
                                </label>
                                <input 
                                    type="file" 
                                    className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                />
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Revision Category :
                                </label>
                                <select className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                                    {modCategories.filter((category) => category.Obsolete).map((category) => (
                                        <option key={category.Id} value={category.CodeGroup}>
                                            {category.CodeDescription}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Reasons :
                                </label>
                                <select className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                                    {modReasons.map((reason) => (
                                        <option key={reason.Id} value={reason.CodeGroup}>
                                            {reason.CodeDescription}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </form>
                   
                </DialogPanel>
                
            </div>
        </Dialog>
    );

};

export default AdjustProjectDialog;
