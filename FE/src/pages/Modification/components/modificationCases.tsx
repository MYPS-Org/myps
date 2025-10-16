import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';

interface ModificationCaseProps {
    fieldName: string;
    index: number;
    modification: any;
}

// Project Description modification case
export const ProjectDescriptionCase: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
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
    return (
        <div>
            
        </div>
    );
};

// Default unsupported case
export const UnsupportedCase: React.FC<ModificationCaseProps> = ({ fieldName: _fieldName, index: _index, modification: _modification }) => {
    return <span>Unsupported field</span>;
};

// Configuration object that maps field names to their respective components
export const modificationCases: Record<string, React.FC<ModificationCaseProps>> = {
    'Project Description': ProjectDescriptionCase,
    'Project Description needs items removed due to typo error': ProjectDescriptionTypoCase,
    'Overlapping Sections of Work': OverlappingSectionsCase,
};

// Helper function to get the appropriate case component
export const getModificationCase = (fieldName: string): React.FC<ModificationCaseProps> => {
    return modificationCases[fieldName] || UnsupportedCase;
};
