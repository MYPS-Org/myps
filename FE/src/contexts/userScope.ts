/*  2026-10-31: which projects a group sees is the group's "Project visibility" setting (Edit Group,
    Helpers/GroupProjectScope.cs), no longer a rule on group names. What is still matched by NAME is the
    revision approval workflow: DPC submits, RPC endorses, AUC approves (RevisionController and the
    Revision pages), so these three groups cannot be renamed. Keep in step with
    UserManagementController.WorkflowGroupNames. */
export const NAME_LOCKED_GROUPS = ['DPC', 'RPC', 'AUC'];
