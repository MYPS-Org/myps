/* =============================================================================
   Project visibility — test account roles, LOCAL DATABASES ONLY
   Date: 2026-10-18 · Plan: documents/plans/project-visibility-by-deo-region.md
   -----------------------------------------------------------------------------
   Gives seven existing accounts the roles the DEO/Region project view gate is tested with:

     asisjnt      DPC                  PlantillaOffice OI55  Cavite 1st DEO
     yabutgj      RPC                  PlantillaOffice OI238 Region IV-A  (parent of OI55)
     ferrermaa    AUC                  (office unchanged)
     caldokp      DPC                  PlantillaOffice OI19  Abra DEO
     afundardb    RPC                  PlantillaOffice OI234 CAR          (parent of OI19)
     jopiojvc     AUC                  (office unchanged)
     salaniokaes  Admin + Super Admin  (office unchanged)

   "Super Admin" is a group of its own granted EVERY tApiActions row and EVERY tAppViews row.
   It exists because Admin lacks 8 actions, and granting them to Admin would reach every Admin
   user (570 locally), including revision approval and program publishing.

   The gate reads tUsers.PlantillaOffice, so that is what this sets. RegCode is left alone.
   Groups are matched by NAME, never by Id. Idempotent: re-running converges to the same state,
   and Super Admin picks up any action or route added since. Touches no other user or group.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* -- 0. Local server only ------------------------------------------------------ */
IF HOST_NAME() <> CAST(SERVERPROPERTY('MachineName') AS nvarchar(128))
BEGIN
    RAISERROR('REFUSED: this script changes real accounts'' roles and runs only against a SQL Server on this machine.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @Wanted TABLE (UserId nvarchar(50) PRIMARY KEY, Groups nvarchar(200), PlantillaOffice nvarchar(50) NULL);
INSERT @Wanted VALUES
    (N'asisjnt',     N'DPC',               N'OI55'),
    (N'yabutgj',     N'RPC',               N'OI238'),
    (N'ferrermaa',   N'AUC',               NULL),
    (N'caldokp',     N'DPC',               N'OI19'),
    (N'afundardb',   N'RPC',               N'OI234'),
    (N'jopiojvc',    N'AUC',               NULL),
    (N'salaniokaes', N'Admin|Super Admin', NULL);

IF EXISTS (SELECT 1 FROM @Wanted w WHERE NOT EXISTS (SELECT 1 FROM dbo.tUsers u WHERE u.UserId = w.UserId))
BEGIN
    SELECT w.UserId AS MissingUser FROM @Wanted w WHERE NOT EXISTS (SELECT 1 FROM dbo.tUsers u WHERE u.UserId = w.UserId);
    THROW 50001, 'An account listed above does not exist on this database; nothing changed.', 1;
END

PRINT '--- before ---';
SELECT u.UserId, u.PlantillaOffice, ug.GroupIds, vu.UserGroupNames
FROM dbo.tUsers u LEFT JOIN dbo.tUserGroups ug ON ug.UserId = u.UserId LEFT JOIN dbo.vUsers vu ON vu.UserId = u.UserId
WHERE u.UserId IN (SELECT UserId FROM @Wanted) ORDER BY u.UserId;

BEGIN TRANSACTION;

/* -- 1. Super Admin: every action, every route -------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.tGroups WHERE GroupName = N'Super Admin')
    INSERT dbo.tGroups (GroupName, Description, ApplyFilter, CreatedBy, CreatedDate)
    VALUES (N'Super Admin', N'Every action and every route. Test/admin use; see ProjectVisibility.UserRoles.Dev.sql.',
            0, N'ProjectVisibility.UserRoles.Dev.sql', SYSDATETIME());

DECLARE @SuperAdminId int = (SELECT Id FROM dbo.tGroups WHERE GroupName = N'Super Admin');
DECLARE @AllActions nvarchar(max) = (SELECT '[' + ISNULL(STRING_AGG(CONVERT(varchar(12), Id), ',') WITHIN GROUP (ORDER BY Id), '') + ']' FROM dbo.tApiActions);
DECLARE @AllViews   nvarchar(max) = (SELECT '[' + ISNULL(STRING_AGG(CONVERT(varchar(12), Id), ',') WITHIN GROUP (ORDER BY Id), '') + ']' FROM dbo.tAppViews);

IF EXISTS (SELECT 1 FROM dbo.tGroupRoles WHERE GroupId = @SuperAdminId)
    UPDATE dbo.tGroupRoles SET ActionIds = @AllActions, ViewIds = @AllViews WHERE GroupId = @SuperAdminId;
ELSE
    INSERT dbo.tGroupRoles (GroupId, ActionIds, ViewIds) VALUES (@SuperAdminId, @AllActions, @AllViews);

/* -- 2. Group memberships, by name ---------------------------------------------- */
DECLARE @Ids TABLE (UserId nvarchar(50) PRIMARY KEY, GroupIds nvarchar(200));
INSERT @Ids (UserId, GroupIds)
SELECT w.UserId, '[' + STRING_AGG(CONVERT(varchar(12), g.Id), ',') WITHIN GROUP (ORDER BY g.Id) + ']'
FROM @Wanted w
CROSS APPLY STRING_SPLIT(w.Groups, '|') s
JOIN dbo.tGroups g ON g.GroupName = s.value
GROUP BY w.UserId;

IF (SELECT COUNT(*) FROM @Ids) <> (SELECT COUNT(*) FROM @Wanted)
   OR EXISTS (SELECT 1 FROM @Wanted w CROSS APPLY STRING_SPLIT(w.Groups, '|') s
              WHERE NOT EXISTS (SELECT 1 FROM dbo.tGroups g WHERE g.GroupName = s.value))
BEGIN
    THROW 50002, 'A group named in @Wanted does not exist; nothing changed.', 1;  -- THROW, not RAISERROR: it aborts and rolls back
END

UPDATE ug SET ug.GroupIds = i.GroupIds
FROM dbo.tUserGroups ug JOIN @Ids i ON i.UserId = ug.UserId
WHERE ug.GroupIds <> i.GroupIds;

INSERT dbo.tUserGroups (UserId, GroupIds, CreatedBy, CreatedDate)
SELECT i.UserId, i.GroupIds, N'ProjectVisibility.UserRoles.Dev.sql', SYSDATETIME()
FROM @Ids i WHERE NOT EXISTS (SELECT 1 FROM dbo.tUserGroups ug WHERE ug.UserId = i.UserId);

/* -- 3. Offices: the gate's OFFICE SOURCE ---------------------------------------- */
UPDATE u SET u.PlantillaOffice = w.PlantillaOffice
FROM dbo.tUsers u JOIN @Wanted w ON w.UserId = u.UserId
WHERE w.PlantillaOffice IS NOT NULL AND ISNULL(u.PlantillaOffice, N'') <> w.PlantillaOffice;

COMMIT TRANSACTION;

/* -- 4. Prove it ------------------------------------------------------------------ */
PRINT '--- after ---';
SELECT u.UserId, u.PlantillaOffice,
       OfficeIs = CASE WHEN d.ParticipantId IS NOT NULL THEN N'DEO ' + d.Name + N' (region ' + ISNULL(d.RegionParticipantId, N'?') + N')'
                       WHEN r.ParticipantId IS NOT NULL THEN N'Region ' + r.Name
                       ELSE N'-' END,
       ug.GroupIds, vu.UserGroupNames, vu.ApplyFilter
FROM dbo.tUsers u
LEFT JOIN dbo.tUserGroups ug ON ug.UserId = u.UserId
LEFT JOIN dbo.vUsers vu ON vu.UserId = u.UserId
LEFT JOIN dbo.vAdminDEO d ON d.ParticipantId = u.PlantillaOffice
LEFT JOIN dbo.tOptionAdminAreaRegion r ON r.ParticipantId = u.PlantillaOffice
WHERE u.UserId IN (N'asisjnt', N'yabutgj', N'ferrermaa', N'caldokp', N'afundardb', N'jopiojvc', N'salaniokaes')
ORDER BY u.UserId;

SELECT GroupName = N'Super Admin',
       GrantedActions = (SELECT COUNT(*) FROM dbo.tGroupRoles gr CROSS APPLY OPENJSON(gr.ActionIds) WITH (Id INT '$') j WHERE gr.GroupId = g.Id),
       AllActions     = (SELECT COUNT(*) FROM dbo.tApiActions),
       GrantedViews   = (SELECT COUNT(*) FROM dbo.tGroupRoles gr CROSS APPLY OPENJSON(gr.ViewIds) WITH (Id INT '$') j WHERE gr.GroupId = g.Id),
       AllViews       = (SELECT COUNT(*) FROM dbo.tAppViews)
FROM dbo.tGroups g WHERE g.GroupName = N'Super Admin';
GO

SET NOEXEC OFF;
GO
