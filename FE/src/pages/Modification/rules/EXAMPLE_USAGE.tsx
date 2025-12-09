/**
 * Example Usage of Dynamic Field Permission System
 * 
 * This file demonstrates how to use the new value-based field validation
 * in your components.
 */

import React, { useCallback, useState } from 'react';
import RuleManager from './RuleManager';

// ============================================================================
// EXAMPLE 1: Basic Usage in a Form Component
// ============================================================================

interface Example1Props {
    categoryDesc: string;
    reasonDesc: string;
    pcmaStatus: string;
    packageStatus: string;
    projectData: any;
}

const Example1BasicUsage: React.FC<Example1Props> = ({
    categoryDesc,
    reasonDesc,
    pcmaStatus,
    packageStatus,
    projectData
}) => {
    // Determine the case based on PCMA status and package status
    const currentCase = RuleManager.determineCase(pcmaStatus, packageStatus, categoryDesc);
    
    // Create a reusable field validation function
    const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
        return RuleManager.isFieldEditableWithValue(
            fieldName,
            currentCase,
            currentValue,
            categoryDesc,
            reasonDesc
        );
    }, [currentCase, categoryDesc, reasonDesc]);
    
    return (
        <div>
            <h3>Project Details</h3>
            
            {/* Example: Start Date Field */}
            <div>
                <label>Planned Start Date:</label>
                <input
                    type="date"
                    value={projectData.StartDate || ''}
                    disabled={!isFieldEditable('StartDate', projectData.StartDate)}
                />
            </div>
            
            {/* Example: End Date Field */}
            <div>
                <label>Planned End Date:</label>
                <input
                    type="date"
                    value={projectData.EndDate || ''}
                    disabled={!isFieldEditable('EndDate', projectData.EndDate)}
                />
            </div>
        </div>
    );
};

// ============================================================================
// EXAMPLE 2: With Status Messages
// ============================================================================

const Example2WithStatusMessages: React.FC<Example1Props> = ({
    categoryDesc,
    reasonDesc,
    pcmaStatus,
    packageStatus,
    projectData
}) => {
    const currentCase = RuleManager.determineCase(pcmaStatus, packageStatus, categoryDesc);
    
    const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
        return RuleManager.isFieldEditableWithValue(
            fieldName,
            currentCase,
            currentValue,
            categoryDesc,
            reasonDesc
        );
    }, [currentCase, categoryDesc, reasonDesc]);
    
    const getFieldStatus = useCallback((fieldName: string, currentValue?: any) => {
        return RuleManager.getFieldEditStatus(
            fieldName,
            currentCase,
            currentValue,
            categoryDesc,
            reasonDesc
        );
    }, [currentCase, categoryDesc, reasonDesc]);
    
    return (
        <div>
            <h3>Project Details with Status Messages</h3>
            
            <div>
                <label>Planned Start Date:</label>
                <input
                    type="date"
                    value={projectData.StartDate || ''}
                    disabled={!isFieldEditable('StartDate', projectData.StartDate)}
                    title={getFieldStatus('StartDate', projectData.StartDate).reason}
                />
                {/* Display status message below field */}
                {!isFieldEditable('StartDate', projectData.StartDate) && (
                    <p className="text-sm text-gray-500">
                        {getFieldStatus('StartDate', projectData.StartDate).reason}
                    </p>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// EXAMPLE 3: Complete Form with Multiple Fields
// ============================================================================

interface FormData {
    StartDate: string;
    EndDate: string;
    PhysicalTarget: number;
    City: string;
    Description: string;
}

const Example3CompleteForm: React.FC = () => {
    const [formData, setFormData] = useState<FormData>({
        StartDate: '',
        EndDate: '',
        PhysicalTarget: 0,
        City: '',
        Description: ''
    });
    
    // Simulated modification context
    const categoryDesc = 'adjustment';
    const reasonDesc = 'Input of missing Planned Start/End Date (only if null or zero)';
    const pcmaStatus = 'On-going';
    const packageStatus = 'packaged';
    
    const currentCase = RuleManager.determineCase(pcmaStatus, packageStatus, categoryDesc);
    
    const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
        return RuleManager.isFieldEditableWithValue(
            fieldName,
            currentCase,
            currentValue,
            categoryDesc,
            reasonDesc
        );
    }, [currentCase]);
    
    const handleChange = (field: keyof FormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };
    
    return (
        <form>
            <div>
                <label>Description:</label>
                <textarea
                    value={formData.Description}
                    onChange={(e) => handleChange('Description', e.target.value)}
                    disabled={!isFieldEditable('Description', formData.Description)}
                />
            </div>
            
            <div>
                <label>Start Date:</label>
                <input
                    type="date"
                    value={formData.StartDate}
                    onChange={(e) => handleChange('StartDate', e.target.value)}
                    disabled={!isFieldEditable('StartDate', formData.StartDate)}
                />
            </div>
            
            <div>
                <label>End Date:</label>
                <input
                    type="date"
                    value={formData.EndDate}
                    onChange={(e) => handleChange('EndDate', e.target.value)}
                    disabled={!isFieldEditable('EndDate', formData.EndDate)}
                />
            </div>
            
            <div>
                <label>Physical Target:</label>
                <input
                    type="number"
                    value={formData.PhysicalTarget}
                    onChange={(e) => handleChange('PhysicalTarget', Number(e.target.value))}
                    disabled={!isFieldEditable('PhysicalTarget', formData.PhysicalTarget)}
                />
            </div>
            
            <button type="submit">Save</button>
        </form>
    );
};

// ============================================================================
// EXAMPLE 4: Testing Different Scenarios
// ============================================================================

const Example4TestingScenarios = () => {
    const categoryDesc = 'adjustment';
    
    // Scenario 1: Field is null/empty - should be editable
    const scenario1 = () => {
        const reasonDesc = 'Input of missing Planned Start/End Date (only if null or zero)';
        const currentCase = 'CaseA';
        const startDate = null;
        
        const canEdit = RuleManager.isFieldEditableWithValue(
            'StartDate',
            currentCase,
            startDate,
            categoryDesc,
            reasonDesc
        );
        
        console.log('Scenario 1 - Null date:', canEdit); // Should be true
    };
    
    // Scenario 2: Field has a value - should NOT be editable
    const scenario2 = () => {
        const reasonDesc = 'Input of missing Planned Start/End Date (only if null or zero)';
        const currentCase = 'CaseA';
        const startDate = '2024-01-15';
        
        const canEdit = RuleManager.isFieldEditableWithValue(
            'StartDate',
            currentCase,
            startDate,
            categoryDesc,
            reasonDesc
        );
        
        console.log('Scenario 2 - Existing date:', canEdit); // Should be false
    };
    
    // Scenario 3: Get detailed status
    const scenario3 = () => {
        const reasonDesc = 'Input of missing Planned Start/End Date (only if null or zero)';
        const currentCase = 'CaseA';
        const startDate = '2024-01-15';
        
        const status = RuleManager.getFieldEditStatus(
            'StartDate',
            currentCase,
            startDate,
            categoryDesc,
            reasonDesc
        );
        
        console.log('Scenario 3 - Status:', status);
        // Should be: { canEdit: false, reason: 'Field already has a value...' }
    };
    
    return (
        <div>
            <h3>Testing Scenarios</h3>
            <button onClick={scenario1}>Test Scenario 1: Null Date</button>
            <button onClick={scenario2}>Test Scenario 2: Existing Date</button>
            <button onClick={scenario3}>Test Scenario 3: Get Status</button>
        </div>
    );
};

// ============================================================================
// EXAMPLE 5: Integration with Existing ComponentCostDialog Pattern
// ============================================================================

interface ComponentCostDialogExampleProps {
    categoryDesc?: string;
    reasonDesc?: string;
    currentCase?: string;
    pcmaStatus?: string;
    packageStatus?: string;
    editingCost?: any;
}

const ComponentCostDialogExample: React.FC<ComponentCostDialogExampleProps> = ({
    categoryDesc,
    reasonDesc,
    currentCase,
    pcmaStatus,
    packageStatus,
    editingCost
}) => {
    const [formData, setFormData] = useState({
        StartDate: editingCost?.StartDate || '',
        EndDate: editingCost?.EndDate || '',
        Description: editingCost?.Description || ''
    });
    
    // Determine case if not provided
    const determinedCase = currentCase || (pcmaStatus && packageStatus 
        ? RuleManager.determineCase(pcmaStatus, packageStatus, categoryDesc)
        : 'CaseA');
    
    // Field validation
    const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
        if (!categoryDesc || !reasonDesc) {
            return true; // No restrictions if not specified
        }
        
        return RuleManager.isFieldEditableWithValue(
            fieldName,
            determinedCase,
            currentValue,
            categoryDesc,
            reasonDesc
        );
    }, [determinedCase, categoryDesc, reasonDesc]);
    
    const getFieldEditStatus = useCallback((fieldName: string, currentValue?: any) => {
        if (!categoryDesc || !reasonDesc) {
            return { canEdit: true, reason: 'No restrictions' };
        }
        
        return RuleManager.getFieldEditStatus(
            fieldName,
            determinedCase,
            currentValue,
            categoryDesc,
            reasonDesc
        );
    }, [determinedCase, categoryDesc, reasonDesc]);
    
    return (
        <div>
            {/* Start Date with dynamic validation */}
            <div>
                <label>
                    Start Date
                    {(() => {
                        const status = getFieldEditStatus('StartDate', formData.StartDate);
                        if (!status.canEdit && formData.StartDate) {
                            return <span className="text-xs text-gray-500"> ({status.reason})</span>;
                        }
                        return null;
                    })()}
                </label>
                <input
                    type="date"
                    value={formData.StartDate}
                    onChange={(e) => setFormData({...formData, StartDate: e.target.value})}
                    disabled={!isFieldEditable('StartDate', formData.StartDate)}
                    className={!isFieldEditable('StartDate', formData.StartDate) ? 'disabled-input' : ''}
                    title={getFieldEditStatus('StartDate', formData.StartDate).reason}
                />
            </div>
            
            {/* End Date with dynamic validation */}
            <div>
                <label>
                    End Date
                    {(() => {
                        const status = getFieldEditStatus('EndDate', formData.EndDate);
                        if (!status.canEdit && formData.EndDate) {
                            return <span className="text-xs text-gray-500"> ({status.reason})</span>;
                        }
                        return null;
                    })()}
                </label>
                <input
                    type="date"
                    value={formData.EndDate}
                    onChange={(e) => setFormData({...formData, EndDate: e.target.value})}
                    disabled={!isFieldEditable('EndDate', formData.EndDate)}
                    className={!isFieldEditable('EndDate', formData.EndDate) ? 'disabled-input' : ''}
                    title={getFieldEditStatus('EndDate', formData.EndDate).reason}
                />
            </div>
        </div>
    );
};

// Export all examples
export {
    Example1BasicUsage,
    Example2WithStatusMessages,
    Example3CompleteForm,
    Example4TestingScenarios,
    ComponentCostDialogExample
};
