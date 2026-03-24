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
    fieldValueConditions?: Record<string, Record<string, (value: any) => boolean>>;
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
    // New value-based methods
    canEditFieldBasedOnValue?: (fieldName: string, currentValue: any, reason?: string) => boolean;
    isFieldEditableWithValue?: (fieldName: string, currentCase: string, fieldValue?: any, reason?: string) => boolean;
    getFieldEditStatus?: (fieldName: string, currentCase: string, fieldValue?: any, reason?: string) => { canEdit: boolean; reason: string };
}

class RuleManager {
    private static getRuleSet(category?: string): FieldPermissionRule {
        // Normalize category string: remove spaces, special chars, convert to lowercase
        const categoryKey = category?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') || 'modification';
        
        switch (categoryKey) {
            case 'adjustment':
                return AdjustmentFields;
            case 'modification':
                 return AllowedFields;
            case 'changeinauthoritytoimplement':
            case 'changeinauthority':
                return ChangeInAuthority;
            case 'additionalfunding':
            case 'additionalfund':
                return AdditionalFund;
            case 'abandonmentforsavings':
            case 'niabandonment':
            case 'niabandonmentforsavings':
                return NIAbandonment;
            case 'delisted':
            case 'nidelisted':
                return NIDelisted;
            case 'forreversion':
            case 'nireversion':
                return NIReversion;
            case 'termination':
                return Termination;
            case 'forsavingspartialunutilizedbalance':
            case 'forsavings':
                return AllowedFields; // Add specific rule if needed
            case 'changeinfunding':
                return AllowedFields; // Add specific rule if needed
            case 'modeofimplementation':
                return AllowedFields; // Add specific rule if needed
            case 'multiyearcostingchanges':
            case 'multiyearcosting':
                return AllowedFields; // Add specific rule if needed
            case 'expiredfunding':
                return AllowedFields; // Add specific rule if needed
            case 'changeofcreditor':
                return AllowedFields; // Add specific rule if needed
            case 'nonimplementable':
                return AllowedFields; // Add specific rule if needed
            case 'categoryatypographicalerror':
            case 'categorya':
                return AllowedFields; // Add specific rule if needed
            case 'categorybchangeinstationlimitsduetoincreaseordecreaseinbudget':
            case 'categoryb':
                return AllowedFields; // Add specific rule if needed
            case 'categorycchangeinlocation':
            case 'categoryc':
                return AllowedFields; // Add specific rule if needed
            case 'categorydchangeinoperatingunitou':
            case 'categoryd':
                return AllowedFields; // Add specific rule if needed
            case 'categoryeduetotheoccurrenceofcalamity':
            case 'categorye':
                return AllowedFields; // Add specific rule if needed
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
        console.log('=== RULE MANAGER - determineCase ===');
        console.log('Input - PCMA Status:', pcmaStatus);
        console.log('Input - Package Status:', packageStatus);
        console.log('Input - Category:', category);
        
        const ruleSet = this.getRuleSet(category);
        console.log('Using RuleSet:', ruleSet === AllowedFields ? 'AllowedFields' : 'Other');
        
        const result = ruleSet.determineCase(pcmaStatus, packageStatus);
        console.log('Result Case:', result);
        console.log('===================================');
        
        return result;
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

    static canEditFieldBasedOnValue(fieldName: string, currentValue: any, category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.canEditFieldBasedOnValue ? ruleSet.canEditFieldBasedOnValue(fieldName, currentValue, reason) : true;
    }

    static isFieldEditableWithValue(fieldName: string, currentCase: string, fieldValue: any, category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        return ruleSet.isFieldEditableWithValue 
            ? ruleSet.isFieldEditableWithValue(fieldName, currentCase, fieldValue, reason) 
            : ruleSet.isFieldEditable(fieldName, currentCase, reason);
    }

    static getFieldEditStatus(fieldName: string, currentCase: string, fieldValue: any, category?: string, reason?: string) {
        const ruleSet = this.getRuleSet(category);
        if (ruleSet.getFieldEditStatus) {
            return ruleSet.getFieldEditStatus(fieldName, currentCase, fieldValue, reason);
        }
        // Fallback for rule sets that don't have this method
        const canEdit = ruleSet.isFieldEditable(fieldName, currentCase, reason);
        return {
            canEdit,
            reason: canEdit ? 'Field is editable' : 'Field is not editable for this case/reason combination'
        };
    }
}

export default RuleManager;