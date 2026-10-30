/* =============================================================================
   Migration — vUserActionPermission / vUserViewPermission list only users who can sign in
   Date: 2026-10-31 · User Management audit (S04)
   -----------------------------------------------------------------------------
   Migration.PermissionViewsEmployeeIdFilter.2026-09-18.sql gave both views the
   rule vUsers uses (WHERE EmployeeId IS NOT NULL). A later rebuild of the views
   outside this repo (the table-rename migration) recreated them without it: on
   myps_db_dev on 2026-10-31 they listed 582 users while vUsers, which sign-in and
   every permission check read first, had 580. The two extra accounts (yabutg,
   asisj: EmployeeId NULL) cannot sign in, so nothing was exploitable, but an
   access audit read from these views showed rights no session can use.

   This restores the filter, so both views cover exactly the vUsers population:
   a tUserGroups row (the INNER JOIN) and a non-NULL EmployeeId. No data changes.

   Idempotent (CREATE OR ALTER); run by hand per environment, like the other
   Migration.* scripts. Check first:
     SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.vUserActionPermission'));
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
GO

CREATE OR ALTER VIEW [dbo].[vUserActionPermission] AS
SELECT DISTINCT
    tu.Id,
    tu.UserId,
    pa.ControllerName AS PermissionController,
    pa.ActionName     AS PermissionAction,
    tu.IsActive
FROM dbo.tUsers tu
INNER JOIN dbo.tUserGroups ug ON ug.UserId = tu.UserId
CROSS APPLY OPENJSON(ug.GroupIds) WITH (GroupId INT '$') gid
INNER JOIN dbo.tGroupRoles gr ON gr.GroupId = gid.GroupId
CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') aid
INNER JOIN dbo.tApiActions pa ON pa.Id = aid.ActionId
WHERE tu.EmployeeId IS NOT NULL;   -- the same rule as vUsers
GO

CREATE OR ALTER VIEW [dbo].[vUserViewPermission] AS
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
WHERE tu.EmployeeId IS NOT NULL;   -- the same rule as vUsers
GO

-- Verify: all three counts are equal.
SELECT
    (SELECT COUNT(*) FROM dbo.vUsers)                                   AS vUsers,
    (SELECT COUNT(DISTINCT UserId) FROM dbo.vUserActionPermission)      AS ActionPermissionUsers,
    (SELECT COUNT(DISTINCT UserId) FROM dbo.vUserViewPermission)        AS ViewPermissionUsers;
GO
