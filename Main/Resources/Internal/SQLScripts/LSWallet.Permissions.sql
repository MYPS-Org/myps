/* =============================================================================
   LS Wallet (Lumpsum) — register + grant the Phase 1 API actions
   -----------------------------------------------------------------------------
   Normally POST /api/UserManagement/SyncAPIPermissions does this by reflecting
   over CoreController subclasses. That endpoint writes to tPermissionControllers
   / tPermissionActions, which DO NOT EXIST under those names in this database —
   here the grant list lives in dbo.tApiActions (see the comment on
   dbo.vUserActionPermission: "renamed tables only"). Until the C# DbSet names
   and the DB agree, the sync endpoint fails with
   "Invalid object name 'tPermissionControllers'", so this script does the same
   job directly.

   [PermissionFilter] resolves the controller as RouteData["controller"] +
   "Controller", i.e. 'LumpsumController', and the action as the method name.

   Idempotent — safe to re-run.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @Controller nvarchar(50) = N'LumpsumController';

/* ── 1. Register any action not already present ───────────────────────────── */
DECLARE @Actions TABLE (ActionName nvarchar(50) PRIMARY KEY, Description nvarchar(200));
INSERT INTO @Actions (ActionName, Description) VALUES
    (N'InitFilterLumpsum',    N'Dropdown sources for the LS Wallet list filter bar'),
    (N'ShowLumpsum',          N'Paged LS Wallet list'),
    (N'LumpsumDetails',       N'Single LS Wallet with its live balance'),
    (N'ShowItemizedProjects', N'Paged itemized projects under an LS Wallet'),
    (N'WalletBalance',        N'Live Total / Used / Available for an LS Wallet');

INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
SELECT a.ActionName, a.Description, @Controller
FROM   @Actions a
WHERE  NOT EXISTS (
    SELECT 1 FROM dbo.tApiActions t
    WHERE t.ControllerName = @Controller AND t.ActionName = a.ActionName
);

/* ── 2. Grant every Lumpsum action to the Admin group (Id 1) ──────────────── */
/* ActionIds is a JSON int array; merge in anything missing and leave the rest
   of the group's grants untouched. */
DECLARE @GroupId int = 1;

;WITH LumpsumActions AS (
    SELECT Id FROM dbo.tApiActions WHERE ControllerName = @Controller
),
Existing AS (
    SELECT a.ActionId AS Id
    FROM   dbo.tGroupRoles gr
    CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
    WHERE  gr.GroupId = @GroupId
),
Merged AS (
    SELECT Id FROM Existing
    UNION
    SELECT Id FROM LumpsumActions
)
UPDATE gr
   SET gr.ActionIds = (
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), Id)
            FROM Merged ORDER BY Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']'
       )
FROM dbo.tGroupRoles gr
WHERE gr.GroupId = @GroupId;

/* ── 3. Grant the LS Wallet ROUTES (views), not just the API actions ──────── */
/* The React router only registers a route whose RouteName appears in the
   user's ViewAccess (FE/src/hooks/usePermittedRoutes.ts). Without this, hitting
   /lumpsum/add fails with "No routes matched location" in the console and the
   page renders nothing — the API permissions above are necessary but not
   sufficient. Route names live in dbo.tAppViews; grants are the ViewIds JSON
   array on dbo.tGroupRoles. */

;WITH LumpsumViews AS (
    SELECT Id FROM dbo.tAppViews
    WHERE RouteName IN (N'LumpSumList', N'LumpSumDetails', N'AddWallet')
),
ExistingViews AS (
    SELECT v.ViewId AS Id
    FROM   dbo.tGroupRoles gr
    CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId INT '$') v
    WHERE  gr.GroupId = @GroupId
),
MergedViews AS (
    SELECT Id FROM ExistingViews
    UNION
    SELECT Id FROM LumpsumViews
)
UPDATE gr
   SET gr.ViewIds = (
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), Id)
            FROM MergedViews ORDER BY Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']'
       )
FROM dbo.tGroupRoles gr
WHERE gr.GroupId = @GroupId;

COMMIT TRANSACTION;
GO

/* ── 4. Verification ──────────────────────────────────────────────────────── */
PRINT '--- registered Lumpsum actions ---';
SELECT Id, ActionName, ControllerName FROM dbo.tApiActions
WHERE ControllerName = N'LumpsumController' ORDER BY ActionName;

PRINT '--- users who can now reach them (top 5) ---';
SELECT TOP 5 UserId, PermissionController, PermissionAction
FROM   dbo.vUserActionPermission
WHERE  PermissionController = N'LumpsumController'
ORDER  BY UserId, PermissionAction;

PRINT '--- grant count per action ---';
SELECT PermissionAction, COUNT(DISTINCT UserId) AS Users
FROM   dbo.vUserActionPermission
WHERE  PermissionController = N'LumpsumController'
GROUP  BY PermissionAction
ORDER  BY PermissionAction;

PRINT '--- ROUTE (view) grants -- all three must be present or the page will not render ---';
SELECT RouteName, COUNT(DISTINCT UserId) AS Users
FROM   dbo.vUserViewPermission
WHERE  RouteName IN (N'LumpSumList', N'LumpSumDetails', N'AddWallet')
GROUP  BY RouteName
ORDER  BY RouteName;
GO
