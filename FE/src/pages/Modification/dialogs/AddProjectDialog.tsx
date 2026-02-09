import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/16/solid";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/tailwindui/table";
import { Button } from "../../../components/tailwindui/button";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { getModificationProjects, type ModificationProject } from "../mockData/ProjectData";

interface AddProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddProjectDialog: React.FC<AddProjectDialogProps> = ({ isOpen, onClose }) => {

    const [searchInput, setSearchInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [ projects, setProjects ] = useState<ModificationProject[]>([]);
    const [ filteredProjects, setFilteredProjects ] = useState<ModificationProject[]>([]);

    useEffect(() => {
        const projectData = getModificationProjects();
        setProjects(projectData);
        setFilteredProjects(projectData);
    }, []);

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    }

    const handleSearchSubmit = () => {
        // setIsLoading(true);
        // Implement search logic here
        console.log("Searching for:", searchInput);
    }

    const handleClearSearch = () => {
        setSearchInput("");
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">

                <DialogPanel className="w-full max-w-6xl bg-white rounded-lg shadow-xl p-6">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Add Project
                            </DialogTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                {/* {project.programName} - {project.projectId} */}
                            </p>
                        </div>
                        <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 "
                        >
                        <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex justify-between items-center space-x-3 pt-4">
                        <div className="flex items-center space-x-2">
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search Projects..."
                                    // value={searchInput}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearchSubmit();
                                        }
                                    }}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <Button 
                                color="blue" 
                                onClick={handleSearchSubmit}
                                disabled={isLoading}
                                className="text-xs px-3 py-1.5"
                            >
                                <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                                Search
                            </Button>
                            {searchInput && (
                                <Button 
                                    color="red" 
                                    onClick={handleClearSearch}
                                    disabled={isLoading}
                                    className="text-xs px-3 py-1.5"
                                >
                                    <XMarkIcon className="w-4 h-4 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>

                    <Table className="px-5" striped>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Program Name</TableHeader>
                                <TableHeader>Project ID</TableHeader>
                                <TableHeader>Description</TableHeader>
                                <TableHeader>Date</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                        No projects found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProjects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell className="font-medium">{project.programName}</TableCell>
                                        <TableCell>{project.projectId}</TableCell>
                                        <TableCell>{project.description}</TableCell>
                                        <TableCell>{new Date(project.date).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </DialogPanel>
            </div>
            
        </Dialog>
    );
}

export default AddProjectDialog;