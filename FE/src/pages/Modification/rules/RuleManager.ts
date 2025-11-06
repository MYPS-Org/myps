import AllowedFields from './AllowedFields';
import AdjustmentFields from './AdjustmentFields';

interface FieldPermissionRule {
    projectDetailFields: string[];
    projectFundingProfileFields?: string[];
    projectComponentFields: string[];
    majorItemOfWorkFields: string[];
    physicalTargetFields: string[];
    pcmaStatus: string[];
    packageStatus: string[];
    getPcmaStatus: () => string;
    packaged: () => string;
    determineCase: (pcmaStatus: string, packageStatus: string) => string;
    getEditableFieldsForCase: (caseType: string) => string[];
    runRandomization: () => any;
    isFieldEditable: (fieldName: string, currentCase: string) => boolean;
    setCaseA: () => any;
    setCaseB: () => any;
    setCaseC: () => any;
}

class RuleManager {
    private static getRuleSet(category?: string): FieldPermissionRule {
        const categoryKey = category?.toLowerCase() || 'modification';
        
        switch (categoryKey) {
            case 'adjustment':
                return AdjustmentFields;
            case 'modification':
            default:
                return AllowedFields;
        }
    }

    static runRandomization(category?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.runRandomization();
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static setCaseA(category?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.setCaseA();
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static setCaseB(category?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.setCaseB();
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static setCaseC(category?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.setCaseC();
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static determineCase(pcmaStatus: string, packageStatus: string, category?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.determineCase(pcmaStatus, packageStatus);
    }

    static getEditableFieldsForCase(caseType: string, category?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.getEditableFieldsForCase(caseType);
    }

    static isFieldEditable(fieldName: string, currentCase: string, category?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.isFieldEditable(fieldName, currentCase);
    }
}

export default RuleManager;