-- ============================================================================
-- Migration: vUserViewPermission / vUserActionPermission EmployeeId filter
-- + Group 1 ("Admin") ViewIds correction
-- Date: 2026-09-18
-- ============================================================================
--
-- Context: neither vUserViewPermission nor vUserActionPermission previously had
-- any version-controlled source anywhere in this repo -- they existed only as
-- live database objects. This script is the first time either view's DDL is
-- captured in source control, alongside the actual fix.
--
-- Finding 1 (root cause, confirmed via live OBJECT_DEFINITION()): both views
-- join dbo.tUsers directly with no completeness filter, while the sibling view
-- vUsers -- the one AuthenticationController.cs's _Session is actually typed
-- against -- already filters `WHERE EmployeeId IS NOT NULL`. This let 5
-- incomplete "stub" tUsers rows (asisj, asisjnt, ferrermaa, yabutg, yabutgj --
-- Ids 601-605, EmployeeId/Email NULL, Name literally equal to UserId,
-- CreatedBy='System', created 2026-08-25/27) leak 75 phantom rows into
-- vUserViewPermission and 570 phantom rows into vUserActionPermission. These 5
-- accounts cannot actually authenticate (they fail vUsers's own filter), so
-- this was not exploitable, but it made both permission views misleading for
-- any access audit and was a latent risk if those stub rows are ever completed
-- without an access review. Per the operator (2026-09-18): the 5 stub accounts
-- themselves are left untouched this pass -- only the view definitions change,
-- adding the same completeness filter vUsers already uses.
--
-- Finding 2 (confirmed via full ViewIds/ActionIds resolution to real route/
-- action names): Group 1 ("Admin", GroupName misleading -- it is actually the
-- default/base tier holding 572 of 581 users, not a small admin cohort) had
-- ProjectController.AddProject and the full ProgramController action set in
-- its ActionIds, but was missing the matching AddProject/ProgramList/
-- ProgramDetails routes from its ViewIds -- meaning 572 real users held live
-- backend authority to add projects and administer programs with no UI route
-- to reach those pages normally. Every other group (AUC/RPC/DPC/SD/DPDC-PDC/
-- DPD Admin) already had these three routes in both ViewIds and ActionIds;
-- only Group 1 was out of sync. `Settings` was checked and deliberately NOT
-- added -- Group 1 has zero Settings-related entries in its ActionIds, so its
-- absence from ViewIds is already correct. Operator confirmed (2026-09-18,
-- AskUserQuestion): the actions are correct, the views were left off -- add
-- them, additive only, no access removed from anyone.
-- ============================================================================

ALTER VIEW [dbo].[vUserViewPermission] AS
SELECT DISTINCT
    tu.Id,
    tu.UserId,
    pv.RouteName AS RouteName,
    tu.IsActive
FROM dbo.tUsers tu
INNER JOIN dbo.tUserGroups ug ON ug.UserId = tu.UserId
CROSS APPLY OPENJSON(ug.GroupIds) WITH (GroupId INT '$') gid
INNER JOIN dbo.tGroupRoles gr ON gr.GroupId = gid.GroupId
CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId INT '$') aid
INNER JOIN dbo.tAppViews pv ON pv.Id = aid.ViewId
WHERE tu.EmployeeId IS NOT NULL;
GO

ALTER VIEW [dbo].[vUserActionPermission] AS
SELECT DISTINCT
    tu.Id,
    tu.UserId,
    pa.ControllerName AS PermissionController,
    pa.ActionName AS PermissionAction,
    tu.IsActive
FROM dbo.tUsers tu
INNER JOIN dbo.tUserGroups ug ON ug.UserId = tu.UserId
CROSS APPLY OPENJSON(ug.GroupIds) WITH (GroupId INT '$') gid
INNER JOIN dbo.tGroupRoles gr ON gr.GroupId = gid.GroupId
CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') aid
INNER JOIN dbo.tApiActions pa ON pa.Id = aid.ActionId
WHERE tu.EmployeeId IS NOT NULL;
GO

-- Group 1 ("Admin") ViewIds before: [1,2,3,6,8,9,10,11,12,13,21,22,23,24,25]
-- Adds: 4 (ProgramList), 5 (ProgramDetails), 7 (AddProject)
UPDATE dbo.tGroupRoles
SET ViewIds = '[1,2,3,4,5,6,7,8,9,10,11,12,13,21,22,23,24,25]'
WHERE Id = 1 AND GroupId = 1;
GO
