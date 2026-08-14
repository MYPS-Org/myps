import type { ComponentCost } from '../../Project/Model';
import { generateTempId } from '../../../utils/GlobalFunctions';

const addExcessComponent = (
    params: {
        projectId: string;
        projectFK?: string;
        projectRevisionFK?: number;
        source?: string;
        stageName: string;
        amount: number;
        description?: string;
        createdBy?: string;
    }
): ComponentCost => {
    const now = new Date().toISOString();
    return {
        Id: generateTempId(),
        Source: params.source ?? '',
        ProjectRevisionFK: params.projectRevisionFK ?? 0,
        ProjectFK: params.projectFK ?? '',
        ProjectId: params.projectId,
        StageName: params.stageName,
        ComponentType: 'Excess',
        ComponentId: 'EXC',
        Description: params.description ?? 'Excess',
        Total: params.amount,
        CreatedBy: params.createdBy ?? '-',
        CreatedDate: now,
        UpdatedBy: params.createdBy ?? '-',
        UpdatedDate: now,
        IsDeleted: false
    };
};

export default addExcessComponent;