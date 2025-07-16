import type { ProjectDetails } from "../Model";

const ProjectDetailsForm: React.FC<{ projectDetails: ProjectDetails }> = ({ projectDetails }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-left text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Project ID</label>
                    <p className="mt-1 text-sm text-gray-900">{projectDetails.Id}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Program Name</label>
                    <p className="mt-1 text-sm text-gray-900">{projectDetails.ProgramName}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <p className="mt-1 text-sm text-gray-900">{projectDetails.Category}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Total Project Cost</label>
                    <p className="mt-1 text-sm text-gray-900">{projectDetails.TotalProjectCost.toLocaleString()}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Created By</label>
                    <p className="mt-1 text-sm text-gray-900">{projectDetails.CreatedBy}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Created Date</label>
                    <p className="mt-1 text-sm text-gray-900">{projectDetails.CreatedDate}</p>
                </div>
            </div>
        </div>
    );
}