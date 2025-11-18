import React, { useState } from 'react';
import RuleManager from '../rules/RuleManager';

/**
 * Test Component for Adjustment Category Reason-Based Field Rules
 * 
 * This component demonstrates how the dynamic field rule system works
 * with both case-based and reason-based filtering.
 */
const AdjustmentRulesTester: React.FC = () => {
    const [pcmaStatus, setPcmaStatus] = useState<string>('Not yet started');
    const [packageStatus, setPackageStatus] = useState<string>('not packaged');
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [result, setResult] = useState<any>(null);

    const availableReasons = RuleManager.getAvailableReasons('adjustment');

    const testRules = () => {
        const currentCase = RuleManager.determineCase(pcmaStatus, packageStatus, 'adjustment');
        const editableFields = RuleManager.getEditableFieldsForCase(currentCase, 'adjustment', selectedReason);
        
        setResult({
            pcmaStatus,
            packageStatus,
            case: currentCase,
            reason: selectedReason,
            editableFields: editableFields,
            fieldCount: editableFields.length
        });
    };

    const testRandomize = () => {
        const randomResult = RuleManager.runRandomization('adjustment', selectedReason);
        setResult(randomResult);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h2 className="text-2xl font-bold text-blue-900 mb-2">
                    Adjustment Category - Rule Tester
                </h2>
                <p className="text-blue-700">
                    Test how Case-based and Reason-based rules work together
                </p>
            </div>

            {/* Controls */}
            <div className="bg-white border rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold mb-4">Test Parameters</h3>
                
                {/* PCMA Status */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        PCMA Status
                    </label>
                    <select 
                        value={pcmaStatus}
                        onChange={(e) => setPcmaStatus(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                    >
                        <option value="Not yet started">Not yet started</option>
                        <option value="On-going">On-going</option>
                        <option value="Completed">Completed</option>
                        <option value="Terminated">Terminated</option>
                    </select>
                </div>

                {/* Package Status */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Package Status
                    </label>
                    <select 
                        value={packageStatus}
                        onChange={(e) => setPackageStatus(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                    >
                        <option value="not packaged">Not Packaged</option>
                        <option value="packaged">Packaged</option>
                    </select>
                </div>

                {/* Reason */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjustment Reason (Optional)
                    </label>
                    <select 
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                    >
                        <option value="">-- No Reason Filter (Case Only) --</option>
                        {availableReasons.map((reason) => (
                            <option key={reason} value={reason}>
                                {reason}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                    <button
                        onClick={testRules}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Test Current Settings
                    </button>
                    <button
                        onClick={testRandomize}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                        Randomize Status
                    </button>
                </div>
            </div>

            {/* Results */}
            {result && (
                <div className="bg-white border rounded-lg p-6 space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Results</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="font-semibold">PCMA Status:</span>
                            <span className="ml-2 text-blue-600">{result.pcmaStatus}</span>
                        </div>
                        <div>
                            <span className="font-semibold">Package Status:</span>
                            <span className="ml-2 text-blue-600">{result.packageStatus}</span>
                        </div>
                        <div>
                            <span className="font-semibold">Case:</span>
                            <span className="ml-2 text-green-600 font-bold">{result.case}</span>
                        </div>
                        <div>
                            <span className="font-semibold">Field Count:</span>
                            <span className="ml-2 text-orange-600 font-bold">{result.fieldCount}</span>
                        </div>
                    </div>

                    {result.reason && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <span className="font-semibold">Reason Filter Applied:</span>
                            <p className="text-sm mt-1 text-gray-700">{result.reason}</p>
                        </div>
                    )}

                    <div className="mt-4">
                        <h4 className="font-semibold mb-2">Editable Fields:</h4>
                        <div className="bg-gray-50 p-4 rounded border max-h-64 overflow-y-auto">
                            {result.editableFields.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {result.editableFields.map((field: string) => (
                                        <li key={field} className="text-sm text-gray-700">
                                            {field}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 italic">No fields are editable</p>
                            )}
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                        <h4 className="font-semibold text-blue-900 mb-2">How this works:</h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                            <li>
                                <strong>Case determination:</strong> Based on PCMA Status ({result.pcmaStatus}) 
                                and Package Status ({result.packageStatus}), the system determined this is <strong>{result.case}</strong>
                            </li>
                            {result.reason ? (
                                <>
                                    <li>
                                        <strong>Case fields:</strong> {result.case} initially allows certain fields to be editable
                                    </li>
                                    <li>
                                        <strong>Reason filter:</strong> The reason "{result.reason}" further restricts 
                                        which fields can be edited
                                    </li>
                                    <li>
                                        <strong>Final result:</strong> Only fields allowed by BOTH the case AND the reason 
                                        are editable ({result.fieldCount} fields)
                                    </li>
                                </>
                            ) : (
                                <li>
                                    <strong>No reason filter:</strong> Only case-based rules apply, 
                                    showing all fields allowed for {result.case}
                                </li>
                            )}
                        </ol>
                    </div>
                </div>
            )}

            {/* Quick Examples */}
            <div className="bg-gray-50 border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Test Scenarios</h3>
                <div className="space-y-2 text-sm">
                    <div className="p-3 bg-white border rounded">
                        <strong>Scenario 1:</strong> Not yet started + Not packaged (Case A) + "Correction of MYPS typographical error"
                        <br />
                        <span className="text-gray-600">Expected: Only 'Description' field editable</span>
                    </div>
                    <div className="p-3 bg-white border rounded">
                        <strong>Scenario 2:</strong> On-going + Packaged (Case B) + No reason
                        <br />
                        <span className="text-gray-600">Expected: Description, EmergencyMode, Origin, etc.</span>
                    </div>
                    <div className="p-3 bg-white border rounded">
                        <strong>Scenario 3:</strong> Completed (Case C) + Any reason
                        <br />
                        <span className="text-gray-600">Expected: No fields editable</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdjustmentRulesTester;
