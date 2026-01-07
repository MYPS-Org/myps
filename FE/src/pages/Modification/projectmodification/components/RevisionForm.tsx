

import type { 
    ProjectDetails, 
    ComponentCost, 
    ComponentCostYear,
    MajorItemOfWork,
    MajorItemLocations,
    FundingProfile,
} from '../../../Project/Model.d';
import type { ForCorrectionsDetails } from '../../Model';
import type { FieldRules, RevisionDoc } from '../../Model';

interface RevisionFormProps {
    category?: string;
    reason?: string;
    projectDetails?: ProjectDetails;
    componentCosts?: ComponentCost[];
    componentCostYear?: ComponentCostYear[];
    majorItemOfWorks?: MajorItemOfWork[];
    majorItemLocations?: MajorItemLocations[];
    fundingProfile?: FundingProfile[];
    revisionDocs?: RevisionDoc[];
    forCorrectionsDetails?: ForCorrectionsDetails[];

    // added for pcma status and editable fields
    statusName?: string;
    packageStatus?: string;
    fieldRules?: FieldRules | null;
    pcmaStatus?: string;
    currentCase?: string;
}

const RevisionForm: React.FC<RevisionFormProps> = ({ 
    category, 
    reason,
    projectDetails,
    fieldRules,
    pcmaStatus,
    packageStatus,
    // currentCase,
    revisionDocs,
    forCorrectionsDetails,
    statusName,
}) => {
    
    console.log('RevisionForm - Received props:', { category, reason, fieldRules });
    
    // Helper function to get editable fields from a rule group
    const getEditableFields = (rules: Record<string, boolean> | undefined) => {
        if (!rules) return [];
        return Object.entries(rules)
            .filter(([_, isEditable]) => isEditable === true)
            .map(([fieldName, _]) => fieldName);
    };

    // Helper function to get non-editable fields from a rule group
    const getNonEditableFields = (rules: Record<string, boolean> | undefined) => {
        if (!rules) return [];
        return Object.entries(rules)
            .filter(([_, isEditable]) => isEditable === false)
            .map(([fieldName, _]) => fieldName);
    };

    // Helper function to format field name for display
    const formatFieldName = (fieldName: string) => {
        // Convert camelCase to Title Case with spaces
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
    };
    
    return (
        <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Revision Details</h2>
            <div className="space-y-4">
                
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className="w-1/3 text-gray-600">Category:</label>
                            <input className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate" value={category} readOnly />
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className='w-1/3 text-gray-600'>Reason</label>
                            <input className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate' value={reason} readOnly />
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className='w-1/3 text-gray-600'>Project ID:</label>
                            <input className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate' value={projectDetails?.ProjectId} readOnly />
                        </div>
                    </div>
                </div>

                {/* Document Section */}
                <div className="mb-6 p-6 border border-gray-200 rounded-lg shadow-md bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h4 className="text-lg font-bold text-gray-900">Revision Documents</h4>
                        </div>
                    </div>

                    {revisionDocs && revisionDocs.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Request Documents */}
                            <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
                                <h5 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Requested Documents
                                </h5>
                                <div className="space-y-2">
                                    {revisionDocs.filter(doc => !doc.IsApprovedDocument).length > 0 ? (
                                        revisionDocs.filter(doc => !doc.IsApprovedDocument).map((doc) => (
                                            <div key={doc.Id} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="text-sm text-gray-700 truncate" title={doc.DocumentName}>
                                                        {doc.DocumentName}
                                                    </span>
                                                </div>
                                                <a
                                                    href={'https://2639m87p-44331.asse.devtunnels.ms/api' + doc.DocumentPath}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-shrink-0 ml-2 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 transition-colors"
                                                >
                                                    View
                                                </a>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500 italic text-center py-4">No request documents available</p>
                                    )}
                                </div>
                            </div>

                            {/* Approved Documents */}
                            <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                                <h5 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Approved Documents
                                </h5>
                                <div className="space-y-2">
                                    {revisionDocs.filter(doc => doc.IsApprovedDocument).length > 0 ? (
                                        revisionDocs.filter(doc => doc.IsApprovedDocument).map((doc) => (
                                            <div key={doc.Id} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="text-sm text-gray-700 truncate" title={doc.DocumentName}>
                                                        {doc.DocumentName}
                                                    </span>
                                                </div>
                                                <a
                                                    href={doc.DocumentPath}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-shrink-0 ml-2 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded hover:bg-green-200 transition-colors"
                                                >
                                                    View
                                                </a>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500 italic text-center py-4">No approved documents available</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600 text-center">No documents available for this revision</p>
                        </div>
                    )}
                </div>

                {/* For Corrections History Section */}
                <div className="mb-6 p-6 border border-gray-200 rounded-lg shadow-md bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="text-lg font-bold text-gray-900">For Corrections History</h4>
                        </div>
                    </div>

                    {forCorrectionsDetails && forCorrectionsDetails.length > 0 ? (
                        <div className="space-y-4">
                            {forCorrectionsDetails.map((correction, index) => (
                                <div key={correction.Id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <h5 className="text-sm font-bold text-gray-800">Correction #{index + 1}</h5>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            Transaction ID: {correction.TransactionId}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Regional Office Comments */}
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <h6 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Regional Office</h6>
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-blue-700 font-medium mb-1">Comment:</p>
                                                    <p className="text-sm text-gray-800 bg-white p-2 rounded border border-blue-100">
                                                        {correction.ROComment || 'No comment provided'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-blue-700 font-medium mb-1">Date:</p>
                                                    <p className="text-sm text-gray-800 font-mono">
                                                        {correction.ROForCorrectionDate ? 
                                                            new Date(correction.ROForCorrectionDate).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            }) : 'Not specified'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Central Office Comments */}
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                                                </svg>
                                                <h6 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Central Office</h6>
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-orange-700 font-medium mb-1">Comment:</p>
                                                    <p className="text-sm text-gray-800 bg-white p-2 rounded border border-orange-100">
                                                        {correction.COComment || 'No comment provided'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-orange-700 font-medium mb-1">Date:</p>
                                                    <p className="text-sm text-gray-800 font-mono">
                                                        {correction.COForCorrectionDate ? 
                                                            new Date(correction.COForCorrectionDate).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            }) : 'Not specified'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600 text-center flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                No correction history available for this revision
                            </p>
                        </div>
                    )}
                </div>

                {/* Field Permissions and Rules Information */}
                <div className="mb-6 p-6 border border-gray-200 rounded-lg shadow-md bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <h4 className="text-lg font-bold text-gray-900">Field Revision Permissions</h4>
                        </div>
                    </div>
                    
                    {/* Status Information Grid */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        <div className="bg-white p-4 border border-blue-100 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">PCMA Status</p>
                            <p className="text-sm font-bold text-gray-900">{pcmaStatus || 'N/A'}</p>
                        </div>
                        <div className="bg-white p-4 border border-blue-100 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Package Status</p>
                            <p className="text-sm font-bold text-gray-900">{packageStatus || 'N/A'}</p>
                        </div>
                        <div className="bg-white p-4 border border-blue-100 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Status</p>
                            <p className="text-sm font-bold text-gray-900">{statusName || 'N/A'}</p>
                        </div>
                        <div className="bg-white p-4 border border-blue-100 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Category</p>
                            <p className="text-sm font-bold text-gray-900">{category || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Detailed Field Rules */}
                    {fieldRules ? (
                        <div className="space-y-4">
                            {/* Project Details Rules */}
                            {fieldRules.ProjectDetailsRules && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Project Details Rules
                                    </h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-semibold text-green-700 mb-2">✓ Editable Fields ({getEditableFields(fieldRules.ProjectDetailsRules).length})</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getEditableFields(fieldRules.ProjectDetailsRules).length > 0 ? (
                                                    getEditableFields(fieldRules.ProjectDetailsRules).map((field, idx) => (
                                                        <span key={idx} className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 border border-green-300 rounded">
                                                            {formatFieldName(field)}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-500 italic">None</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 mb-2">✗ Non-Editable Fields ({getNonEditableFields(fieldRules.ProjectDetailsRules).length})</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getNonEditableFields(fieldRules.ProjectDetailsRules).length > 0 ? (
                                                    getNonEditableFields(fieldRules.ProjectDetailsRules).map((field, idx) => (
                                                        <span key={idx} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded">
                                                            {formatFieldName(field)}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-500 italic">None</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Component Cost Rules */}
                            {fieldRules.ComponentCostRules && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Component Cost Rules
                                    </h5>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-semibold text-green-700 mb-2">✓ Editable Fields ({getEditableFields(fieldRules.ComponentCostRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getEditableFields(fieldRules.ComponentCostRules.Fields).length > 0 ? (
                                                        getEditableFields(fieldRules.ComponentCostRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 border border-green-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-600 mb-2">✗ Non-Editable Fields ({getNonEditableFields(fieldRules.ComponentCostRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getNonEditableFields(fieldRules.ComponentCostRules.Fields).length > 0 ? (
                                                        getNonEditableFields(fieldRules.ComponentCostRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {fieldRules.ComponentCostRules.CRUD && (
                                            <div className="pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-blue-700 mb-2">CRUD Permissions</p>
                                                <div className="flex gap-3 text-xs">
                                                    <span className={`px-2 py-1 rounded ${fieldRules.ComponentCostRules.CRUD.CanAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Add: {fieldRules.ComponentCostRules.CRUD.CanAdd ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded ${fieldRules.ComponentCostRules.CRUD.CanDelete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Delete: {fieldRules.ComponentCostRules.CRUD.CanDelete ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    {fieldRules.ComponentCostRules.CRUD.Message && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                            Note: {fieldRules.ComponentCostRules.CRUD.Message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Component Cost Year Rules */}
                            {fieldRules.ComponentCostYearRules && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Component Cost Year Rules
                                    </h5>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-semibold text-green-700 mb-2">✓ Editable Fields ({getEditableFields(fieldRules.ComponentCostYearRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getEditableFields(fieldRules.ComponentCostYearRules.Fields).length > 0 ? (
                                                        getEditableFields(fieldRules.ComponentCostYearRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 border border-green-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-600 mb-2">✗ Non-Editable Fields ({getNonEditableFields(fieldRules.ComponentCostYearRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getNonEditableFields(fieldRules.ComponentCostYearRules.Fields).length > 0 ? (
                                                        getNonEditableFields(fieldRules.ComponentCostYearRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {fieldRules.ComponentCostYearRules.CRUD && (
                                            <div className="pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-blue-700 mb-2">CRUD Permissions</p>
                                                <div className="flex gap-3 text-xs">
                                                    <span className={`px-2 py-1 rounded ${fieldRules.ComponentCostYearRules.CRUD.CanAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Add: {fieldRules.ComponentCostYearRules.CRUD.CanAdd ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded ${fieldRules.ComponentCostYearRules.CRUD.CanDelete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Delete: {fieldRules.ComponentCostYearRules.CRUD.CanDelete ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    {fieldRules.ComponentCostYearRules.CRUD.Message && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                            Note: {fieldRules.ComponentCostYearRules.CRUD.Message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Major Item of Work Rules */}
                            {fieldRules.MajorItemOfWorkRules && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        Major Item of Work Rules
                                    </h5>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-semibold text-green-700 mb-2">✓ Editable Fields ({getEditableFields(fieldRules.MajorItemOfWorkRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getEditableFields(fieldRules.MajorItemOfWorkRules.Fields).length > 0 ? (
                                                        getEditableFields(fieldRules.MajorItemOfWorkRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 border border-green-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-600 mb-2">✗ Non-Editable Fields ({getNonEditableFields(fieldRules.MajorItemOfWorkRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getNonEditableFields(fieldRules.MajorItemOfWorkRules.Fields).length > 0 ? (
                                                        getNonEditableFields(fieldRules.MajorItemOfWorkRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {fieldRules.MajorItemOfWorkRules.CRUD && (
                                            <div className="pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-blue-700 mb-2">CRUD Permissions</p>
                                                <div className="flex gap-3 text-xs">
                                                    <span className={`px-2 py-1 rounded ${fieldRules.MajorItemOfWorkRules.CRUD.CanAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Add: {fieldRules.MajorItemOfWorkRules.CRUD.CanAdd ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded ${fieldRules.MajorItemOfWorkRules.CRUD.CanDelete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Delete: {fieldRules.MajorItemOfWorkRules.CRUD.CanDelete ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    {fieldRules.MajorItemOfWorkRules.CRUD.Message && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                            Note: {fieldRules.MajorItemOfWorkRules.CRUD.Message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Major Item Location Rules */}
                            {fieldRules.MajorItemLocationRules && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Major Item Location Rules
                                    </h5>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-semibold text-green-700 mb-2">✓ Editable Fields ({getEditableFields(fieldRules.MajorItemLocationRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getEditableFields(fieldRules.MajorItemLocationRules.Fields).length > 0 ? (
                                                        getEditableFields(fieldRules.MajorItemLocationRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 border border-green-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-600 mb-2">✗ Non-Editable Fields ({getNonEditableFields(fieldRules.MajorItemLocationRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getNonEditableFields(fieldRules.MajorItemLocationRules.Fields).length > 0 ? (
                                                        getNonEditableFields(fieldRules.MajorItemLocationRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {fieldRules.MajorItemLocationRules.CRUD && (
                                            <div className="pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-blue-700 mb-2">CRUD Permissions</p>
                                                <div className="flex gap-3 text-xs">
                                                    <span className={`px-2 py-1 rounded ${fieldRules.MajorItemLocationRules.CRUD.CanAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Add: {fieldRules.MajorItemLocationRules.CRUD.CanAdd ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded ${fieldRules.MajorItemLocationRules.CRUD.CanDelete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Delete: {fieldRules.MajorItemLocationRules.CRUD.CanDelete ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    {fieldRules.MajorItemLocationRules.CRUD.Message && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                            Note: {fieldRules.MajorItemLocationRules.CRUD.Message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Funding Profile Rules */}
                            {fieldRules.FundingProfileRules && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Funding Profile Rules
                                    </h5>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-semibold text-green-700 mb-2">✓ Editable Fields ({getEditableFields(fieldRules.FundingProfileRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getEditableFields(fieldRules.FundingProfileRules.Fields).length > 0 ? (
                                                        getEditableFields(fieldRules.FundingProfileRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 border border-green-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-600 mb-2">✗ Non-Editable Fields ({getNonEditableFields(fieldRules.FundingProfileRules.Fields).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getNonEditableFields(fieldRules.FundingProfileRules.Fields).length > 0 ? (
                                                        getNonEditableFields(fieldRules.FundingProfileRules.Fields).map((field, idx) => (
                                                            <span key={idx} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded">
                                                                {formatFieldName(field)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">None</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {fieldRules.FundingProfileRules.CRUD && (
                                            <div className="pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-blue-700 mb-2">CRUD Permissions</p>
                                                <div className="flex gap-3 text-xs">
                                                    <span className={`px-2 py-1 rounded ${fieldRules.FundingProfileRules.CRUD.CanAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Add: {fieldRules.FundingProfileRules.CRUD.CanAdd ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded ${fieldRules.FundingProfileRules.CRUD.CanDelete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        Delete: {fieldRules.FundingProfileRules.CRUD.CanDelete ? '✓ Allowed' : '✗ Denied'}
                                                    </span>
                                                    {fieldRules.FundingProfileRules.CRUD.Message && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                            Note: {fieldRules.FundingProfileRules.CRUD.Message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                No field rules available. All fields may be restricted.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RevisionForm;