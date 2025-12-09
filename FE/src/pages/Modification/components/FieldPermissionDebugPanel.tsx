import React from 'react';
import { useDebugControls, useFieldPermissionState } from '../hooks/useFieldPermissions';
import { Button } from '../../../components/tailwindui/button';

/**
 * Debug Panel for Field Permissions
 * Shows current status and provides buttons to change cases
 * FOR DEVELOPMENT USE ONLY
 */
const FieldPermissionDebugPanel: React.FC = () => {
    const { setCaseA, setCaseB, setCaseC, randomize, reset } = useDebugControls();
    const { pcmaStatus, packageStatus, currentCase, permissions, context } = useFieldPermissionState();

    return (
        <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-blue-500 rounded-lg shadow-xl p-4 max-w-md">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">🔧 Field Permission Debug</h3>
                <span className="text-xs text-gray-500">DEV ONLY</span>
            </div>

            {/* Current Status */}
            <div className="mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="font-medium text-gray-600">PCMA Status:</span>
                    <span className="font-semibold text-blue-600">{pcmaStatus || '(not set)'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Package Status:</span>
                    <span className="font-semibold text-blue-600">{packageStatus || '(not set)'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Current Case:</span>
                    <span className={`font-semibold ${
                        currentCase === 'CaseA' ? 'text-green-600' :
                        currentCase === 'CaseB' ? 'text-yellow-600' :
                        currentCase === 'CaseC' ? 'text-red-600' :
                        'text-gray-400'
                    }`}>
                        {currentCase || '(not determined)'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Category:</span>
                    <span className="text-gray-700">{context.category || '(not set)'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Reason:</span>
                    <span className="text-gray-700 truncate max-w-[200px]" title={context.reason}>
                        {context.reason || '(not set)'}
                    </span>
                </div>
            </div>

            {/* Editable Fields */}
            {permissions && permissions.editableFields.length > 0 && (
                <div className="mb-4 p-2 bg-green-50 rounded border border-green-200">
                    <div className="text-xs font-medium text-green-800 mb-1">
                        ✓ Editable Fields ({permissions.editableFields.length}):
                    </div>
                    <div className="text-xs text-green-700 max-h-20 overflow-y-auto">
                        {permissions.editableFields.join(', ')}
                    </div>
                </div>
            )}

            {permissions && permissions.editableFields.length === 0 && (
                <div className="mb-4 p-2 bg-red-50 rounded border border-red-200">
                    <div className="text-xs font-medium text-red-800">
                        ⚠ No fields are editable
                    </div>
                </div>
            )}

            {/* Control Buttons */}
            <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                    <Button 
                        onClick={() => setCaseA()}
                        color="green"
                        className="text-xs py-1"
                    >
                        Case A
                    </Button>
                    <Button 
                        onClick={() => setCaseB()}
                        color="yellow"
                        className="text-xs py-1"
                    >
                        Case B
                    </Button>
                    <Button 
                        onClick={() => setCaseC()}
                        color="red"
                        className="text-xs py-1"
                    >
                        Case C
                    </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        onClick={() => randomize()}
                        color="blue"
                        className="text-xs py-1"
                    >
                        🎲 Randomize
                    </Button>
                    <Button 
                        onClick={() => reset()}
                        color="zinc"
                        className="text-xs py-1"
                    >
                        🔄 Reset
                    </Button>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                <div className="font-medium mb-1">Case Legend:</div>
                <div className="space-y-1">
                    <div>• <span className="text-green-600 font-semibold">Case A</span>: Not started + not packaged (most permissive)</div>
                    <div>• <span className="text-yellow-600 font-semibold">Case B</span>: On-going/Not started + packaged (restricted)</div>
                    <div>• <span className="text-red-600 font-semibold">Case C</span>: Completed/Terminated (most restrictive)</div>
                </div>
            </div>
        </div>
    );
};

export default FieldPermissionDebugPanel;
