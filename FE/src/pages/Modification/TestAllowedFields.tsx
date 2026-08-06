import React, { useState } from 'react';
import AllowedFields from './rules/AllowedFields';
import ProjectDetailsForm from './projectmodification/components/ProjectDetailsForm';

const TestAllowedFields: React.FC = () => {
    const [testResult, setTestResult] = useState<any>(null);
    
    // Mock project details data for testing
    const [mockProjectDetails, setMockProjectDetails] = useState({
        Id: 1,
        ProjectFK: 'PROJ-001',
        ProjectType: '',
        ProgramId: 'TEST-001',
        ProgramName: 'Test Program',
        StageName: 'Test Stage',
        ProjectId: 'PROJ-001',
        AlternateId: '',
        ExternalId: '',
        MYId: '',
        UACS: '',
        IslandCode: '',
        Description: 'Test Project Description',
        Category: 1,
        Thrust: 1,
        Origin: 1,
        City: '',
        LegislativeDistrict: '',
        OperatingUnit: '',
        ImplementingOffice: '',
        DEO: '',
        Region: '',
        Agency: 1,
        ImplementationMode: 1,
        EmergencyMode: 0,
        Feasibility: 1,
        DetailedDesign: 0,
        RowAvailable: 0,
        RegionWide: 0,
        Tier: 1,
        CreatedDate: '',
        RevisionCreatedBy: '',
        RevisionCreatedDate: '',
        Source: '',
    });

    const handleRandomize = () => {
        const result = AllowedFields.runRandomization();
        setTestResult(result);
        console.log('Test Result:', result);
    };

    const handleProjectDetailsChange = (field: string, value: any) => {
        setMockProjectDetails(prev => ({
            ...prev,
            [field]: value
        }));
        console.log(`Field ${field} changed to:`, value);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">AllowedFields Integration Test</h1>
            
            {/* Test Controls */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-blue-800 mb-3">Test Controls</h2>
                <button 
                    onClick={handleRandomize}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Randomize PCMA Status & Test
                </button>
                
                {testResult && (
                    <div className="mt-4 p-3 bg-blue-100 rounded">
                        <h3 className="font-semibold text-blue-800">Current Test Status:</h3>
                        <div className="text-sm text-blue-700 grid grid-cols-2 gap-2 mt-2">
                            <div>PCMA Status: <span className="font-medium">{testResult.pcmaStatus}</span></div>
                            <div>Package Status: <span className="font-medium">{testResult.packageStatus}</span></div>
                            <div>Case: <span className="font-medium">{testResult.case}</span></div>
                            <div>Editable Fields: <span className="font-medium">{testResult.editableFields.length}</span></div>
                        </div>
                        <div className="mt-2">
                            <strong>Editable Fields:</strong>
                            <div className="text-xs mt-1 max-h-20 overflow-y-auto">
                                {testResult.editableFields.join(', ')}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Project Details Form with Test Data */}
            <ProjectDetailsForm
                projectDetails={mockProjectDetails}
                onChange={handleProjectDetailsChange}
                mode="edit"
                // pcmaStatus={testResult?.pcmaStatus}
                // packageStatus={testResult?.packageStatus}
                errors={{}}
                disabled={false}
            />

            {/* Instructions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">How to Test:</h2>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Click "Randomize PCMA Status & Test" to generate a random status combination</li>
                    <li>Observe the yellow banner showing the current permission status</li>
                    <li>Try editing different fields in the form below</li>
                    <li>Notice how fields are enabled/disabled based on the current case:
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                            <li><strong>Case A:</strong> Most fields editable (Not yet started + not packaged)</li>
                            <li><strong>Case B:</strong> Only Description, EmergencyMode, Origin editable</li>
                            <li><strong>Case C:</strong> No fields editable (Completed/Terminated)</li>
                        </ul>
                    </li>
                    <li>Hover over disabled fields to see the tooltip explaining why they're disabled</li>
                </ol>
            </div>
        </div>
    );
};

export default TestAllowedFields;