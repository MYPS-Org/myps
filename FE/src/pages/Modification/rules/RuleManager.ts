import AllowedFields from './AllowedFields';
import AdjustmentFields from './AdjustmentFields';
import ChangeInAuthority from './ChangeInAuthority';
import Termination from './Termination';
import AdditionalFund from './AdditionalFund';
import NIAbandonment from './NIAbandonmentForSavings';
import NIDelisted from './NIDelisted';
import NIReversion from './NIReversion';

interface FieldPermissionRule {
    projectDetailFields: string[];
    projectFundingProfileFields?: string[];
    projectComponentFields: string[];
    majorItemOfWorkFields: string[];
    physicalTargetFields: string[];
    reasonSpecificFields?: Record<string, string[]>;
    pcmaStatus: string[];
    packageStatus: string[];
    getPcmaStatus: () => string;
    packaged: () => string;
    determineCase: (pcmaStatus: string, packageStatus: string) => string;
    getEditableFieldsForCase: (caseType: string, reason?: string) => string[];
    runRandomization: (reason?: string) => any;
    isFieldEditable: (fieldName: string, currentCase: string, reason?: string) => boolean;
    getAvailableReasons?: () => string[];
    getFieldsForReason?: (reason: string) => string[];
    setCaseA: (reason?: string) => any;
    setCaseB: (reason?: string) => any;
    setCaseC: (reason?: string) => any;
}

class RuleManager {
    private static getRuleSet(category?: string): FieldPermissionRule {
        const categoryKey = category?.toLowerCase() || 'modification';
        
        switch (categoryKey) {
            case 'adjustment':
                return AdjustmentFields;
            case 'modification':
                 return AllowedFields;
            case 'changeinauthority':
                return ChangeInAuthority;
            case 'additionalfund':
                return AdditionalFund;
            case 'niabandonment':
            case 'niabandonmentforsavings':
                return NIAbandonment;
            case 'nidelisted':
                return NIDelisted;
            case 'nireversion':
                return NIReversion;
            case 'termination':
                return Termination;
            default:
                return AllowedFields;
        }
    }

    static runRandomization(category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.runRandomization(reason);
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static setCaseA(category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.setCaseA(reason);
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static setCaseB(category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.setCaseB(reason);
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static setCaseC(category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        const result = ruleSet.setCaseC(reason);
        return {
            ...result,
            category: category || 'modification'
        };
    }

    static determineCase(pcmaStatus: string, packageStatus: string, category?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.determineCase(pcmaStatus, packageStatus);
    }

    static getEditableFieldsForCase(caseType: string, category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.getEditableFieldsForCase(caseType, reason);
    }

    static isFieldEditable(fieldName: string, currentCase: string, category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.isFieldEditable(fieldName, currentCase, reason);
    }

    static getAvailableReasons(category?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.getAvailableReasons ? ruleSet.getAvailableReasons() : [];
    }

    static getFieldsForReason(reason: string, category?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.getFieldsForReason ? ruleSet.getFieldsForReason(reason) : [];
    }
}

export default RuleManager;