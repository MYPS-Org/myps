// Example usage of the NavPills component with Table
import { useState } from 'react'
import { 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableHeader, 
  TableCell,
  NavPills,
  FilterableTable
} from '../tailwindui/table'

// Example data
const sampleData = [
  { id: 1, name: 'John Doe', status: 'active', department: 'Engineering' },
  { id: 2, name: 'Jane Smith', status: 'inactive', department: 'Marketing' },
  { id: 3, name: 'Bob Johnson', status: 'active', department: 'Sales' },
  { id: 4, name: 'Alice Brown', status: 'pending', department: 'Engineering' },
]

// Example 1: Using NavPills separately with Table
export function TableWithNavPillsExample() {
  const [selectedStatus, setSelectedStatus] = useState('all')

  const statusOptions = [
    { value: 'all', label: 'All Users', count: sampleData.length },
    { value: 'active', label: 'Active', count: sampleData.filter(u => u.status === 'active').length },
    { value: 'inactive', label: 'Inactive', count: sampleData.filter(u => u.status === 'inactive').length },
    { value: 'pending', label: 'Pending', count: sampleData.filter(u => u.status === 'pending').length },
  ]

  const filteredData = selectedStatus === 'all' 
    ? sampleData 
    : sampleData.filter(user => user.status === selectedStatus)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">User Management</h2>
        
        {/* Navigation Pills for filtering */}
        <NavPills
          options={statusOptions}
          selectedValue={selectedStatus}
          onChange={setSelectedStatus}
          className="mb-4"
          variant="pills"
          size="md"
        />
        
        {/* Table */}
        <Table>
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
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.status === 'active' ? 'bg-green-100 text-green-800' :
                    user.status === 'inactive' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {user.status}
                  </span>
                </TableCell>
                <TableCell>{user.department}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Example 2: Using FilterableTable component
export function FilterableTableExample() {
  const [selectedDepartment, setSelectedDepartment] = useState('all')

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    { value: 'Engineering', label: 'Engineering', count: sampleData.filter(u => u.department === 'Engineering').length },
    { value: 'Marketing', label: 'Marketing', count: sampleData.filter(u => u.department === 'Marketing').length },
    { value: 'Sales', label: 'Sales', count: sampleData.filter(u => u.department === 'Sales').length },
  ]

  const filteredData = selectedDepartment === 'all' 
    ? sampleData 
    : sampleData.filter(user => user.department === selectedDepartment)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Department View</h2>
      
      <FilterableTable
        filterOptions={departmentOptions}
        selectedFilter={selectedDepartment}
        onFilterChange={setSelectedDepartment}
        filterVariant="underline"
        filterSize="md"
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
  )
}

// Example 3: Different NavPill variants
export function NavPillVariantsExample() {
  const [selected1, setSelected1] = useState('option1')
  const [selected2, setSelected2] = useState('option1')
  const [selected3, setSelected3] = useState('option1')

  const options = [
    { value: 'option1', label: 'Option 1', count: 5 },
    { value: 'option2', label: 'Option 2', count: 12 },
    { value: 'option3', label: 'Option 3', count: 0 },
    { value: 'option4', label: 'Disabled', disabled: true },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-md font-medium mb-3">Pills Variant</h3>
        <NavPills
          options={options}
          selectedValue={selected1}
          onChange={setSelected1}
          variant="pills"
        />
      </div>

      <div>
        <h3 className="text-md font-medium mb-3">Default Variant</h3>
        <NavPills
          options={options}
          selectedValue={selected2}
          onChange={setSelected2}
          variant="default"
        />
      </div>

      <div>
        <h3 className="text-md font-medium mb-3">Underline Variant</h3>
        <NavPills
          options={options}
          selectedValue={selected3}
          onChange={setSelected3}
          variant="underline"
        />
      </div>
    </div>
  )
}