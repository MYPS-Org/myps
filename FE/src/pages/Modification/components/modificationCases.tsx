import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import MajorItemWorkLocationTable from './MajorItemWorkLocationTable';
import LocationDetails from './LocationDetails';

interface ModificationCaseProps {
    fieldName: string;
    index: number;
    modification: any;
}

// Project Description modification case
export const TypographicalErrorOnProjectDescription: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    return (
        <div>
            <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Old Data</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <input 
                            type="text"
                            value={"Old Description here"}
                            className='w-full border border-gray-300 rounded px-3 py-1 my-1 focus:outline'
                        />
                    </TableBody>
                </Table>
            </div>
            <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Incoming Data</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableCell>
                            <input 
                                type="text"
                                value={"Incoming Description here"}
                                className='w-full border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </TableCell>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

// Project Description with typo error case
export const ProjectDescriptionTypoCase: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    return (
        <div>
            <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Old Data</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <input 
                            type="text"
                            value={"Old Description here"}
                            className='w-full border border-gray-300 rounded px-3 py-1 my-1 focus:outline'
                        />
                    </TableBody>
                </Table>
            </div>
            <div className='pt-4 border border-gray-100 rounded-2xl px-4'>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Incoming Data</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableCell>
                            <input 
                                type="text"
                                value={"Incoming Description here"}
                                className='w-full border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </TableCell>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

// Overlapping Sections of Work case
export const OverlappingSectionsCase: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    const [selectedMajorItems, setSelectedMajorItems] = useState<number[]>([]);
    
    // Mock data - should be replaced with actual data from props/context
    const mockMajorItems = [
        {
            id: 1,
            component: "CW-1",
            yearOfWork: 2024,
            typeOfWork: "Rehabilitation",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 1, infraId: "FS0001LZ", detailedScope: "Road surface repair", from: 0, to: 5, physicalTarget: 5 },
                { id: 2, infraId: "FS0002LZ", detailedScope: "Asphalt overlay", from: 3, to: 8, physicalTarget: 5 }
            ]
        },
        {
            id: 2,
            component: "CW-2",
            yearOfWork: 2024,
            typeOfWork: "New Construction",
            infraType: "Bridge",
            targetUnit: "units",
            workLocations: [
                { id: 3, infraId: "BR001", detailedScope: "New bridge construction", physicalTarget: 1 }
            ]
        },
        {
            id: 3,
            component: "CW-3",
            yearOfWork: 2024,
            typeOfWork: "Widening",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 4, infraId: "FS0004MN", detailedScope: "Road widening", from: 7, to: 12, physicalTarget: 5 }
            ]
        }
    ];

    const handleMajorItemSelection = (index: number) => {
        setSelectedMajorItems(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleWorkLocationEdit = (majorItemIndex: number, locationId: number, field: string, value: any) => {
        console.log(`Editing major item ${majorItemIndex}, location ${locationId}, field ${field}, value:`, value);
        // TODO: Implement actual edit logic
    };

    const handleWorkLocationDelete = (majorItemIndex: number, locationId: number) => {
        console.log(`Deleting location ${locationId} from major item ${majorItemIndex}`);
        // TODO: Implement actual delete logic
    };

    const handleWorkLocationAdd = (majorItemIndex: number) => {
        console.log(`Adding new work location to major item ${majorItemIndex}`);
        // TODO: Implement actual add logic
    };

    return (
        <div className="space-y-6">
            <LocationDetails>
            </LocationDetails>
            {/* Current Work Locations Section */}
            <MajorItemWorkLocationTable
                majorItems={mockMajorItems}
                selectedItems={selectedMajorItems}
                onItemSelect={handleMajorItemSelection}
                showSelection={true}
                readOnly={false}
                onWorkLocationEdit={handleWorkLocationEdit}
                onWorkLocationDelete={handleWorkLocationDelete}
                onWorkLocationAdd={handleWorkLocationAdd}
                title="Current Work Locations"
                description="Select the major items and work locations that have overlapping sections"
            />

            {/* Proposed Changes Section */}
            <div className="border border-green-100 rounded-2xl p-4 bg-green-50">
                <div className="mb-4">
                    <h4 className="text-md font-medium text-green-700 mb-2">Proposed Changes</h4>
                    <p className="text-sm text-green-600">Review and modify the work locations to resolve overlapping sections</p>
                </div>
                
                {selectedMajorItems.length > 0 ? (
                    <MajorItemWorkLocationTable
                        majorItems={selectedMajorItems.map(index => mockMajorItems[index])}
                        showSelection={false}
                        readOnly={false}
                        onWorkLocationEdit={handleWorkLocationEdit}
                        onWorkLocationDelete={handleWorkLocationDelete}
                        onWorkLocationAdd={handleWorkLocationAdd}
                        title=""
                        description=""
                    />
                ) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">
                            <ChevronRightIcon className="w-8 h-8 mx-auto" />
                        </div>
                        <p className="text-sm text-gray-500">
                            Select major items above to see proposed changes
                        </p>
                    </div>
                )}
            </div>

            {/* Summary and Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                    {selectedMajorItems.length} major item(s) selected for modification
                </div>
                <div className="space-x-2">
                    <Button 
                        color="zinc" 
                        className="text-sm px-4 py-2"
                        onClick={() => {
                            setSelectedMajorItems([]);
                        }}
                    >
                        Reset Changes
                    </Button>
                    <Button 
                        color="blue" 
                        className="text-sm px-4 py-2"
                        disabled={selectedMajorItems.length === 0}
                    >
                        Apply Modifications
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Change in work station limits case
export const ChangeInWorkStationLimitsCase: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    const [selectedMajorItems, setSelectedMajorItems] = useState<number[]>([]);
    
    // Mock data - should be replaced with actual data from props/context
    const mockMajorItems = [
        {
            id: 1,
            component: "CW-1",
            yearOfWork: 2024,
            typeOfWork: "Rehabilitation",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 1, infraId: "FS0001LZ", detailedScope: "Road surface repair", from: 0, to: 5, physicalTarget: 5 },
                { id: 2, infraId: "FS0002LZ", detailedScope: "Asphalt overlay", from: 3, to: 8, physicalTarget: 5 }
            ]
        },
        {
            id: 2,
            component: "CW-2",
            yearOfWork: 2024,
            typeOfWork: "New Construction",
            infraType: "Bridge",
            targetUnit: "units",
            workLocations: [
                { id: 3, infraId: "BR001", detailedScope: "New bridge construction", physicalTarget: 1 }
            ]
        },
        {
            id: 3,
            component: "CW-3",
            yearOfWork: 2024,
            typeOfWork: "Widening",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 4, infraId: "FS0004MN", detailedScope: "Road widening", from: 7, to: 12, physicalTarget: 5 }
            ]
        }
    ];

    const handleMajorItemSelection = (index: number) => {
        setSelectedMajorItems(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleWorkLocationEdit = (majorItemIndex: number, locationId: number, field: string, value: any) => {
        console.log(`Editing major item ${majorItemIndex}, location ${locationId}, field ${field}, value:`, value);
        // TODO: Implement actual edit logic
    };

    const handleWorkLocationDelete = (majorItemIndex: number, locationId: number) => {
        console.log(`Deleting location ${locationId} from major item ${majorItemIndex}`);
        // TODO: Implement actual delete logic
    };

    const handleWorkLocationAdd = (majorItemIndex: number) => {
        console.log(`Adding new work location to major item ${majorItemIndex}`);
        // TODO: Implement actual add logic
    };

    return (
        <div className="space-y-6">
            {/* Current Work Locations Section */}
            <MajorItemWorkLocationTable
                majorItems={mockMajorItems}
                selectedItems={selectedMajorItems}
                onItemSelect={handleMajorItemSelection}
                showSelection={true}
                readOnly={false}
                onWorkLocationEdit={handleWorkLocationEdit}
                onWorkLocationDelete={handleWorkLocationDelete}
                onWorkLocationAdd={handleWorkLocationAdd}
                title="Current Work Locations"
                description="Select the major items and work locations that have overlapping sections"
            />

            {/* Proposed Changes Section */}
            <div className="border border-green-100 rounded-2xl p-4 bg-green-50">
                <div className="mb-4">
                    <h4 className="text-md font-medium text-green-700 mb-2">Proposed Changes</h4>
                    <p className="text-sm text-green-600">Review and modify the work locations to resolve overlapping sections</p>
                </div>
                
                {selectedMajorItems.length > 0 ? (
                    <MajorItemWorkLocationTable
                        majorItems={selectedMajorItems.map(index => mockMajorItems[index])}
                        showSelection={false}
                        readOnly={false}
                        onWorkLocationEdit={handleWorkLocationEdit}
                        onWorkLocationDelete={handleWorkLocationDelete}
                        onWorkLocationAdd={handleWorkLocationAdd}
                        title=""
                        description=""
                    />
                ) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">
                            <ChevronRightIcon className="w-8 h-8 mx-auto" />
                        </div>
                        <p className="text-sm text-gray-500">
                            Select major items above to see proposed changes
                        </p>
                    </div>
                )}
            </div>

            {/* Summary and Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                    {selectedMajorItems.length} major item(s) selected for modification
                </div>
                <div className="space-x-2">
                    <Button 
                        color="zinc" 
                        className="text-sm px-4 py-2"
                        onClick={() => {
                            setSelectedMajorItems([]);
                        }}
                    >
                        Reset Changes
                    </Button>
                    <Button 
                        color="blue" 
                        className="text-sm px-4 py-2"
                        disabled={selectedMajorItems.length === 0}
                    >
                        Apply Modifications
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Change in work station limits case
export const IncreaseInTarget: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    const [selectedMajorItems, setSelectedMajorItems] = useState<number[]>([]);
    
    // Mock data - should be replaced with actual data from props/context
    const mockMajorItems = [
        {
            id: 1,
            component: "CW-1",
            yearOfWork: 2024,
            typeOfWork: "Rehabilitation",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 1, infraId: "FS0001LZ", detailedScope: "Road surface repair", from: 0, to: 5, physicalTarget: 5 },
                { id: 2, infraId: "FS0002LZ", detailedScope: "Asphalt overlay", from: 3, to: 8, physicalTarget: 5 }
            ]
        },
        {
            id: 2,
            component: "CW-2",
            yearOfWork: 2024,
            typeOfWork: "New Construction",
            infraType: "Bridge",
            targetUnit: "units",
            workLocations: [
                { id: 3, infraId: "BR001", detailedScope: "New bridge construction", physicalTarget: 1 }
            ]
        },
        {
            id: 3,
            component: "CW-3",
            yearOfWork: 2024,
            typeOfWork: "Widening",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 4, infraId: "FS0004MN", detailedScope: "Road widening", from: 7, to: 12, physicalTarget: 5 }
            ]
        }
    ];

    const handleMajorItemSelection = (index: number) => {
        setSelectedMajorItems(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleWorkLocationEdit = (majorItemIndex: number, locationId: number, field: string, value: any) => {
        console.log(`Editing major item ${majorItemIndex}, location ${locationId}, field ${field}, value:`, value);
        // TODO: Implement actual edit logic
    };

    const handleWorkLocationDelete = (majorItemIndex: number, locationId: number) => {
        console.log(`Deleting location ${locationId} from major item ${majorItemIndex}`);
        // TODO: Implement actual delete logic
    };

    const handleWorkLocationAdd = (majorItemIndex: number) => {
        console.log(`Adding new work location to major item ${majorItemIndex}`);
        // TODO: Implement actual add logic
    };

    return (
        <div className="space-y-6">
            {/* Current Work Locations Section */}
            <MajorItemWorkLocationTable
                majorItems={mockMajorItems}
                selectedItems={selectedMajorItems}
                onItemSelect={handleMajorItemSelection}
                showSelection={true}
                readOnly={false}
                onWorkLocationEdit={handleWorkLocationEdit}
                onWorkLocationDelete={handleWorkLocationDelete}
                onWorkLocationAdd={handleWorkLocationAdd}
                title="Current Work Locations"
                description="Select the major items and work locations that have overlapping sections"
            />

            {/* Proposed Changes Section */}
            <div className="border border-green-100 rounded-2xl p-4 bg-green-50">
                <div className="mb-4">
                    <h4 className="text-md font-medium text-green-700 mb-2">Proposed Changes</h4>
                    <p className="text-sm text-green-600">Review and modify the work locations to resolve overlapping sections</p>
                </div>
                
                {selectedMajorItems.length > 0 ? (
                    <MajorItemWorkLocationTable
                        majorItems={selectedMajorItems.map(index => mockMajorItems[index])}
                        showSelection={false}
                        readOnly={false}
                        onWorkLocationEdit={handleWorkLocationEdit}
                        onWorkLocationDelete={handleWorkLocationDelete}
                        onWorkLocationAdd={handleWorkLocationAdd}
                        title=""
                        description=""
                    />
                ) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">
                            <ChevronRightIcon className="w-8 h-8 mx-auto" />
                        </div>
                        <p className="text-sm text-gray-500">
                            Select major items above to see proposed changes
                        </p>
                    </div>
                )}
            </div>

            {/* Summary and Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                    {selectedMajorItems.length} major item(s) selected for modification
                </div>
                <div className="space-x-2">
                    <Button 
                        color="zinc" 
                        className="text-sm px-4 py-2"
                        onClick={() => {
                            setSelectedMajorItems([]);
                        }}
                    >
                        Reset Changes
                    </Button>
                    <Button 
                        color="blue" 
                        className="text-sm px-4 py-2"
                        disabled={selectedMajorItems.length === 0}
                    >
                        Apply Modifications
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Decrease in target case
export const DecreaseInTarget: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    const [selectedMajorItems, setSelectedMajorItems] = useState<number[]>([]);
    
    // Mock data - should be replaced with actual data from props/context
    const mockMajorItems = [
        {
            id: 1,
            component: "CW-1",
            yearOfWork: 2024,
            typeOfWork: "Rehabilitation",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 1, infraId: "FS0001LZ", detailedScope: "Road surface repair", from: 0, to: 5, physicalTarget: 5 },
                { id: 2, infraId: "FS0002LZ", detailedScope: "Asphalt overlay", from: 3, to: 8, physicalTarget: 5 }
            ]
        },
        {
            id: 2,
            component: "CW-2",
            yearOfWork: 2024,
            typeOfWork: "New Construction",
            infraType: "Bridge",
            targetUnit: "units",
            workLocations: [
                { id: 3, infraId: "BR001", detailedScope: "New bridge construction", physicalTarget: 1 }
            ]
        },
        {
            id: 3,
            component: "CW-3",
            yearOfWork: 2024,
            typeOfWork: "Widening",
            infraType: "Road",
            targetUnit: "km",
            workLocations: [
                { id: 4, infraId: "FS0004MN", detailedScope: "Road widening", from: 7, to: 12, physicalTarget: 5 }
            ]
        }
    ];

    const handleMajorItemSelection = (index: number) => {
        setSelectedMajorItems(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleWorkLocationEdit = (majorItemIndex: number, locationId: number, field: string, value: any) => {
        console.log(`Editing major item ${majorItemIndex}, location ${locationId}, field ${field}, value:`, value);
        // TODO: Implement actual edit logic
    };

    const handleWorkLocationDelete = (majorItemIndex: number, locationId: number) => {
        console.log(`Deleting location ${locationId} from major item ${majorItemIndex}`);
        // TODO: Implement actual delete logic
    };

    const handleWorkLocationAdd = (majorItemIndex: number) => {
        console.log(`Adding new work location to major item ${majorItemIndex}`);
        // TODO: Implement actual add logic
    };

    return (
        <div className="space-y-6">
            {/* Current Work Locations Section */}
            <MajorItemWorkLocationTable
                majorItems={mockMajorItems}
                selectedItems={selectedMajorItems}
                onItemSelect={handleMajorItemSelection}
                showSelection={true}
                readOnly={false}
                onWorkLocationEdit={handleWorkLocationEdit}
                onWorkLocationDelete={handleWorkLocationDelete}
                onWorkLocationAdd={handleWorkLocationAdd}
                title="Current Work Locations"
                description="Select the major items and work locations that have overlapping sections"
            />

            {/* Proposed Changes Section */}
            <div className="border border-green-100 rounded-2xl p-4 bg-green-50">
                <div className="mb-4">
                    <h4 className="text-md font-medium text-green-700 mb-2">Proposed Changes</h4>
                    <p className="text-sm text-green-600">Review and modify the work locations to resolve overlapping sections</p>
                </div>
                
                {selectedMajorItems.length > 0 ? (
                    <MajorItemWorkLocationTable
                        majorItems={selectedMajorItems.map(index => mockMajorItems[index])}
                        showSelection={false}
                        readOnly={false}
                        onWorkLocationEdit={handleWorkLocationEdit}
                        onWorkLocationDelete={handleWorkLocationDelete}
                        onWorkLocationAdd={handleWorkLocationAdd}
                        title=""
                        description=""
                    />
                ) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">
                            <ChevronRightIcon className="w-8 h-8 mx-auto" />
                        </div>
                        <p className="text-sm text-gray-500">
                            Select major items above to see proposed changes
                        </p>
                    </div>
                )}
            </div>

            {/* Summary and Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                    {selectedMajorItems.length} major item(s) selected for modification
                </div>
                <div className="space-x-2">
                    <Button 
                        color="zinc" 
                        className="text-sm px-4 py-2"
                        onClick={() => {
                            setSelectedMajorItems([]);
                        }}
                    >
                        Reset Changes
                    </Button>
                    <Button 
                        color="blue" 
                        className="text-sm px-4 py-2"
                        disabled={selectedMajorItems.length === 0}
                    >
                        Apply Modifications
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Barangay does not exist case
export const NoSuchBarangayExists: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    return (
        <div>
            <LocationDetails>

            </LocationDetails>
        </div>
    )
};

// City/Municipality does not exist case
export const NoSuchCityMunicipality: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    return (
        <div>
            <LocationDetails>
            </LocationDetails>
        </div>
    )
};



// Default unsupported case
export const UnsupportedCase: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    return <span>Unsupported field</span>;
};

// Configuration object that maps field names to their respective components
export const ModificationCases: Record<string, React.FC<ModificationCaseProps>> = {
    'Typographical Error on Project Description': TypographicalErrorOnProjectDescription,
    'Project Description needs items removed due to typo error': ProjectDescriptionTypoCase,
    'Overlapping Sections of Work': OverlappingSectionsCase,
    'Change in work station limits, due to increase or decrease of budget': ChangeInWorkStationLimitsCase,
    'Increase in Target': IncreaseInTarget,
    'Decrease in Target due to additional scope (e.g. ROW)': DecreaseInTarget,
    'No such Barangay exists': NoSuchBarangayExists,
    'No such City/Municipality': NoSuchCityMunicipality,
};

// Helper function to get the appropriate case component
export const getModificationCase = (fieldName: string): React.FC<ModificationCaseProps> => {
    return ModificationCases[fieldName] || UnsupportedCase;
};
