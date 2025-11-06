import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { useDropDownData } from "../hooks/useDropDown";
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/tailwindui/table';
import type { ProjectDetails } from '../../Project/Model';

interface ReviseProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
}

const ReviseProjectDialog: React.FC<ReviseProjectDialogProps> = ({ isOpen, onClose, project }) => {
    const {
        initializeData,
        modCategories,
        modReasons
    } = useDropDownData();

    const [pcmaStatus, setPcmaStatus] = useState<any[]>([]);

    useEffect(() => {
        initializeData();
    }, [initializeData]);

    const handleComponentToggle = (componentId: string) => {
        setPcmaStatus(prev => 
            prev.map(comp => 
                comp.id === componentId 
                    ? { ...comp, selected: !comp.selected }
                    : comp
            )
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedComps = pcmaStatus.filter(comp => comp.selected);
        console.log('Submit revised project:', {
            project: project,
            selectedComponents: selectedComps
        });
        // Handle form submission here
        onClose();
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
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
                            {project.ProjectId}
                        </p>
                    </div>
                    <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 "
                    >
                    <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Project Info */}
                    <div className='bg-gray-50 p-4 rounded-lg space-y-2'>
                        <h4 className="text-sm font-medium text-gray-900">Project Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Project ID:</span>
                                <p className="text-gray-600">{project.ProjectId}</p>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Current Revision:</span>
                                <p className="text-gray-600">Modification</p>
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium text-gray-700">Description:</span>
                                <p className="text-gray-600">{project.Description}</p>
                            </div>
                        </div>
                    </div>

                    {/* Revision Details */}
                    <div className='space-y-2'>
                        <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                Date of Approval :
                            </label>
                            <input 
                                type="date" 
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
                    {/* Component */}
                    {/* <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Select</TableHeader>
                                    <TableHeader>Comp ID</TableHeader>
                                    <TableHeader>Construction Status</TableHeader>
                                    <TableHeader>Permitted</TableHeader>
                                    <TableHeader>Implementation Mode</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pcmaStatus.map((component) => (
                                    <TableRow key={component.id}>
                                        <TableCell>
                                            <input 
                                                type="checkbox" 
                                                checked={component.selected || false}
                                                onChange={() => handleComponentToggle(component.id)}
                                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {component.compId}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                component.constructionStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                                                component.constructionStatus === 'On-Going' ? 'bg-blue-100 text-blue-800' :
                                                component.constructionStatus === 'Packaged' ? 'bg-purple-100 text-purple-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {component.constructionStatus}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                component.permitted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {component.permitted ? 'Yes' : 'No'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {component.implementationMode}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div> */}
                    <div className='pt-4 border border-gray-100 rounded-2xl px-4 flex justify-end gap-5'>
                        <Button
                            type="submit"
                            color="blue"
                        >Submit
                        </Button>
                        <Button
                            onClick={onClose}
                        >Cancel</Button>
                    </div>
                </form>
            </DialogPanel>
            </div>
        </Dialog>
    );
}
export default ReviseProjectDialog;