import type { 
    ProjectDetails, 
    ComponentCost, 
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
    fieldRules: _fieldRules,
    pcmaStatus,
    packageStatus,
    // currentCase,
    revisionDocs,
    forCorrectionsDetails,
    statusName,
}) => {
    
    return (
        <div className="p-6">
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
                                                    href={import.meta.env.VITE_API_BASE_URL?.replace('api', '/') + '/' + doc.DocumentPath}
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
                                                    href={import.meta.env.VITE_API_BASE_URL?.replace('api', '/') + '/' + doc.DocumentPath}
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
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Centralized Comments for correction*/}
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <h6 className="text-xs font-bold text-blue-800 uppercase tracking-wide">{correction.ReturnedBy === 'CO' ? 'Central Office' : 'Regional Office'}</h6>
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-blue-700 font-medium mb-1">Comment:</p>
                                                    <p className="text-sm text-gray-800 bg-white p-2 rounded border border-blue-100">
                                                        {correction.CorrectionReason || 'No comment provided'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-blue-700 font-medium mb-1">Date:</p>
                                                    <p className="text-sm text-gray-800 font-mono">
                                                        {correction.ForCorrectionDate ? 
                                                            new Date(correction.ForCorrectionDate).toLocaleDateString('en-US', {
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
                </div>
            </div>
        </div>
    );
}

export default RevisionForm;