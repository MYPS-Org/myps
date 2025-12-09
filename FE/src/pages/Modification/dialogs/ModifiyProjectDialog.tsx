import { useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { useDropDownData } from '../hooks/useDropDown';
import { Button } from '../../../components/tailwindui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';

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
    };

    const handleChange = (index: number, fieldName: string, value: string) => {
        // Update the form state with the new value
    };

    // Change the type any to real model later
    const renderFormField = (modification: any, fieldName: string, index: number) => {
        switch (fieldName) {
            // Category A
            case 'Project Description':
                return (
                    <input
                        type="text"
                        value={modification.value}
                        onChange={(e) => handleChange(index, fieldName, e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                );
            // Category B
            case 'Station Limits':
                return (
                    <input
                        type="text"
                        value={modification.value}
                        onChange={(e) => handleChange(index, fieldName, e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                );
            // Category C
            case 'Change in Location':
                return (
                    <input
                        type="text"
                        value={modification.value}
                        onChange={(e) => handleChange(index, fieldName, e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                );
            // Category D
            case 'Change Operating Unit':
                return (
                    <input
                        type="text"
                        value={modification.value}
                        onChange={(e) => handleChange(index, fieldName, e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                );
            // Category E not yet known
        }
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Back Drop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl p-6">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Adjustment of Project
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
                                    {/* {modCategories.filter((category) => !category.Obsolete).map((category) => ( */}
                                        {/* <option key={category.Id} value={category.CodeGroup}>
                                            {category.CodeDescription}
                                        </option>
                                    ))} */}
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
                                    className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                />
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Revision Category :
                                </label>
                                <select className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                                    {/* {modCategories.filter((category) => category.Obsolete).map((category) => (
                                        <option key={category.Id} value={category.CodeGroup}>
                                            {category.CodeDescription}
                                        </option>
                                    ))} */}
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
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Construction Status :
                                </label>
                                <input 
                                    type="text" 
                                    name="" 
                                    id="" 
                                    className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                    disabled
                                    value={"Not Yet Started"}
                                />
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Implementation Mode :
                                </label>
                                <input 
                                    type="text" 
                                    name="" 
                                    id="" 
                                    className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                    disabled
                                    value={"By Contract"}
                                />
                            </div>
                            <div className='flex justify-between gap-5 items-center'>
                                <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                    Permitted :
                                </label>
                                <input 
                                    type="text" 
                                    name="" 
                                    id="" 
                                    className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                    disabled
                                    value={"No"}
                                />
                            </div>
                        </div>

                        {/* Component */}
                        <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        {/* <TableHeader>Select</TableHeader> */}
                                        {/* <TableHeader>Current Data</TableHeader> */}
                                        <TableHeader>Old Data</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <input type="text"
                                            value={"Old Description here"}
                                            className='w-full border border-gray-300 rounded px-3 py-1 my-1 focus:outline'
                                        />
                                    {/* {selectedComponents.map((component) => (
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
                                    ))} */}
                                </TableBody>
                            </Table>
                        </div>
                        <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        {/* <TableHeader>Select</TableHeader> */}
                                        {/* <TableHeader>Current Data</TableHeader> */}
                                        <TableHeader>Incoming Data</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableCell>
                                        <input type="text"
                                            value={"Incoming Description here"}
                                            className='w-full border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        />
                                    </TableCell>
                                    {/* {selectedComponents.map((component) => (
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
                                    ))} */}
                                </TableBody>
                            </Table>
                        </div>
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

};

export default AdjustProjectDialog;
