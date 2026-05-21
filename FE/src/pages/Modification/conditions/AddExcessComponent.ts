import type { ComponentCost } from '../../Project/Model';

const addExcessComponent = (
    params: {
        projectId: string;
        stageName: string;
        amount: number;
        description?: string;
        createdBy?: string;
    }
): ComponentCost => {
    const now = new Date().toISOString();
    return {
        Id: 0,
        CostId: '',
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