/* =============================================================================
   Project visibility — e2e fixture accounts, LOCAL DATABASES ONLY
   Date: 2026-10-18 · Plan: documents/plans/project-visibility-by-deo-region.md
   Spec: e2e/tests/project-visibility.spec.ts
   -----------------------------------------------------------------------------
   Four accounts in the REAL groups the gate is about, one group each. The gate reads
   tUsers.PlantillaOffice:

     e2edpc         DPC  OI122  Davao City DEO (Region XI)  -> stages whose DEO is OI122
     e2erpc         RPC  OI246  Region XI                   -> stages whose DEO is under Region XI
     e2eauc         AUC  OI122                              -> everything, whatever the office
     e2edpcnoscope  DPC  OI246  a REGION, wrong for a DPC   -> no scope: 403 on the lists

   OI122 is chosen because 58+ of its projects move to OI3576 (Davao City 3rd DEO, also Region
   XI) at GAA. On those projects e2edpc sees the early stages and NOT the later ones, while
   e2erpc sees all of them. That is the per-stage rule the spec exists to prove.

   Grants are NOT made here: these are real groups, so the script asserts they already hold
   every action the spec calls and stops loudly if not. Otherwise the permission filter 403s
   before the gate runs, and a "refused" assertion passes having tested nothing.

   NOT FOR ANY SHARED OR PRODUCTION SERVER: Development runs with PIS.BypassLogin, so these
   accounts sign in with ANY password. Idempotent: re-running deletes and re-creates these four
   accounts. Touches no other row.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF HOST_NAME() <> CAST(SERVERPROPERTY('MachineName') AS nvarchar(128))
BEGIN
    RAISERROR('REFUSED: this script creates sign-in-able accounts and runs only against a SQL Server on this machine.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -- 1. The real groups must already hold what the spec calls ----------------- */
DECLARE @Needed TABLE (ControllerName nvarchar(50), ActionName nvarchar(100));
INSERT @Needed VALUES
    (N'ProjectController', N'ShowProjects'),
    (N'ProjectController', N'ShowProjectDetails'),
    (N'ProjectController', N'ShowProjectStages'),
    (N'ProjectController', N'ShowProjectTargetComponents'),
    (N'ProjectController', N'ShowProjectStageTargets'),
    (N'ProgramController', N'ShowProjectsInProgram'),
    (N'ProgramController', N'ShowProgram'),
    (N'AuthController',    N'Validate'),
    (N'AuthController',    N'Logout');

SELECT g.GroupName, n.ControllerName + N'.' + n.ActionName AS MissingAction
INTO   #MissingGrants
FROM   dbo.tGroups g
CROSS JOIN @Needed n
LEFT JOIN dbo.tApiActions a ON a.ControllerName = n.ControllerName AND a.ActionName = n.ActionName
LEFT JOIN dbo.tGroupRoles gr ON gr.GroupId = g.Id
WHERE  g.GroupName IN (N'DPC', N'RPC', N'AUC')
  AND  NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (Id INT '$') j WHERE j.Id = a.Id);

IF EXISTS (SELECT 1 FROM #MissingGrants)
BEGIN
    SELECT * FROM #MissingGrants;
    RAISERROR('A real group lacks an action the spec calls (listed above). Grant it through User Management, not here.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -- 2. The four accounts --------------------------------------------------------- */
DECLARE @Fixture TABLE (UserId nvarchar(50) PRIMARY KEY, EmployeeId nvarchar(50), Name nvarchar(200), Office nvarchar(50), GroupName nvarchar(100));
INSERT @Fixture VALUES
    (N'e2edpc',        N'E2E-PV-DPC',      N'E2E Project Visibility (DPC, Davao City DEO)',  N'OI122', N'DPC'),
    (N'e2erpc',        N'E2E-PV-RPC',      N'E2E Project Visibility (RPC, Region XI)',       N'OI246', N'RPC'),
    (N'e2eauc',        N'E2E-PV-AUC',      N'E2E Project Visibility (AUC)',                  N'OI122', N'AUC'),
    (N'e2edpcnoscope', N'E2E-PV-DPC-NONE', N'E2E Project Visibility (DPC with a Region)',    N'OI246', N'DPC');

DELETE FROM dbo.tUserGroups WHERE UserId IN (SELECT UserId FROM @Fixture);
DELETE FROM dbo.tUsers      WHERE UserId IN (SELECT UserId FROM @Fixture);

INSERT dbo.tUsers (EmployeeId, UserId, Name, Email, RegCode, PlantillaOffice, IsActive)
SELECT f.EmployeeId, f.UserId, f.Name, f.UserId + N'@e2e.local', f.Office, f.Office, 1 FROM @Fixture f;

INSERT dbo.tUserGroups (UserId, GroupIds, CreatedBy, CreatedDate)
SELECT f.UserId, N'[' + CAST(g.Id AS nvarchar(12)) + N']', N'ProjectVisibility.Fixture.Dev.sql', SYSDATETIME()
FROM @Fixture f JOIN dbo.tGroups g ON g.GroupName = f.GroupName;

SELECT u.UserId, vu.UserGroupNames, u.PlantillaOffice
FROM dbo.tUsers u JOIN dbo.vUsers vu ON vu.UserId = u.UserId
WHERE u.UserId IN (SELECT UserId FROM @Fixture) ORDER BY u.UserId;
GO

SET NOEXEC OFF;
GO
PRINT 'ProjectVisibility.Fixture.Dev.sql complete. Sign in as e2edpc / e2erpc / e2eauc / e2edpcnoscope with any password (Development only).';
GO
