// Comparison: Different ways to use FilterableTable
import React from 'react';
import { TableHeader, TableRow, TableCell, TableHead, TableBody, FilterableTable, NavPills, Table } from '../tailwindui/table';

const sampleData = [
    { id: 1, name: 'John Doe', status: 'active', department: 'Engineering' },
    { id: 2, name: 'Jane Smith', status: 'inactive', department: 'Marketing' },
    { id: 3, name: 'Bob Johnson', status: 'active', department: 'Sales' },
    { id: 4, name: 'Alice Brown', status: 'pending', department: 'Engineering' },
];

// Method 1: Using FilterableTable (RECOMMENDED - simpler)
export function FilterableTableExample() {
    const [selectedStatus, setSelectedStatus] = React.useState('all');

    const statusOptions = [
        { value: 'all', label: 'All Users', count: sampleData.length },
        { value: 'active', label: 'Active', count: sampleData.filter(u => u.status === 'active').length },
        { value: 'inactive', label: 'Inactive', count: sampleData.filter(u => u.status === 'inactive').length },
        { value: 'pending', label: 'Pending', count: sampleData.filter(u => u.status === 'pending').length },
    ];

    const filteredData = selectedStatus === 'all' 
        ? sampleData 
        : sampleData.filter(user => user.status === selectedStatus);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Method 1: Using FilterableTable</h2>
            
            {/* Single component that includes both NavPills and Table */}
            <FilterableTable
                filterOptions={statusOptions}
                selectedFilter={selectedStatus}
                onFilterChange={setSelectedStatus}
                filterVariant="pills"
                filterSize="md"
                filterClassName="mb-4" // Custom styling for the filter
                className="bg-white shadow rounded-lg"
            >
                <TableHead>
                    <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Department</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredData.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.status}</TableCell>
                            <TableCell>{user.department}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </FilterableTable>
        </div>
    );
}

// Method 2: Using NavPills + Table separately (more control)
export function SeparateComponentsExample() {
    const [selectedStatus, setSelectedStatus] = React.useState('all');

    const statusOptions = [
        { value: 'all', label: 'All Users', count: sampleData.length },
        { value: 'active', label: 'Active', count: sampleData.filter(u => u.status === 'active').length },
        { value: 'inactive', label: 'Inactive', count: sampleData.filter(u => u.status === 'inactive').length },
        { value: 'pending', label: 'Pending', count: sampleData.filter(u => u.status === 'pending').length },
    ];

    const filteredData = selectedStatus === 'all' 
        ? sampleData 
        : sampleData.filter(user => user.status === selectedStatus);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Method 2: Separate NavPills + Table</h2>
            
            {/* Custom header section */}
            <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">User Management</h3>
                <div className="text-sm text-gray-500">
                    {filteredData.length} of {sampleData.length} users
                </div>
            </div>
            
            {/* Separate NavPills component */}
            <NavPills
                options={statusOptions}
                selectedValue={selectedStatus}
                onChange={setSelectedStatus}
                variant="underline"
                size="sm"
            />
            
            {/* Separate Table component */}
            <Table className="bg-white shadow rounded-lg">
                <TableHead>
                    <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Department</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredData.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.status}</TableCell>
                            <TableCell>{user.department}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

// Method 3: FilterableTable with different variants
export function FilterableTableVariantsExample() {
    const [selectedDepartment, setSelectedDepartment] = React.useState('all');

    const departmentOptions = [
        { value: 'all', label: 'All Departments' },
        { value: 'Engineering', label: 'Engineering', count: 2 },
        { value: 'Marketing', label: 'Marketing', count: 1 },
        { value: 'Sales', label: 'Sales', count: 1 },
    ];

    const filteredData = selectedDepartment === 'all' 
        ? sampleData 
        : sampleData.filter(user => user.department === selectedDepartment);

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold">Method 3: Different Filter Variants</h2>
            
            {/* Pills variant */}
            <div>
                <h3 className="text-sm font-medium mb-2">Pills Variant</h3>
                <FilterableTable
                    filterOptions={departmentOptions}
                    selectedFilter={selectedDepartment}
                    onFilterChange={setSelectedDepartment}
                    filterVariant="pills"
                    filterSize="sm"
                    dense
                >
                    <TableHead>
                        <TableRow>
                            <TableHeader>Name</TableHeader>
                            <TableHeader>Department</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredData.slice(0, 2).map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.department}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </FilterableTable>
            </div>

            {/* Underline variant */}
            <div>
                <h3 className="text-sm font-medium mb-2">Underline Variant</h3>
                <FilterableTable
                    filterOptions={departmentOptions}
                    selectedFilter={selectedDepartment}
                    onFilterChange={setSelectedDepartment}
                    filterVariant="underline"
                    filterSize="md"
                    striped
                >
                    <TableHead>
                        <TableRow>
                            <TableHeader>Name</TableHeader>
                            <TableHeader>Department</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredData.slice(0, 2).map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.department}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </FilterableTable>
            </div>

            {/* Default variant */}
            <div>
                <h3 className="text-sm font-medium mb-2">Default Variant</h3>
                <FilterableTable
                    filterOptions={departmentOptions}
                    selectedFilter={selectedDepartment}
                    onFilterChange={setSelectedDepartment}
                    filterVariant="default"
                    filterSize="lg"
                    grid
                >
                    <TableHead>
                        <TableRow>
                            <TableHeader>Name</TableHeader>
                            <TableHeader>Department</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredData.slice(0, 2).map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.department}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </FilterableTable>
            </div>
        </div>
    );
}