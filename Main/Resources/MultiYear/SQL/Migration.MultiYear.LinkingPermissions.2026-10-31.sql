/* =============================================================================
   Migration — Multi-Year module, Phase 2 permissions
   Date: 2026-10-31
   Plan: documents/plans/multi-year-phase-2-annual-program-linking.md
   -----------------------------------------------------------------------------
   Run AFTER Migration.MultiYear.Permissions.2026-10-31.sql (Phase 1) and
   Migration.MultiYear.Linking.2026-10-31.sql. It registers the Phase 2 actions
   of MultiYearController (tApiActions) and MERGES default grants into
   tGroupRoles, by group name. No new page: Phase 2 works inside the Phase 1
   pages (dialogs and tabs).

     Propose to RBP / UBP, Import Projects       Admin, AUC, RPC, DPC, UPC (coordinators)
     Add to PIP, Set PIP Cost                    Admin, PPC          (MY-PFL-18, -19)
     Saved Totals (read)                         Admin, AUC, DPD Admin, RPC, DPC, UPC, PPC
     Save Totals (on request)                    Admin, AUC, RPC, DPC, UPC, PPC
     GAA Updates, Run GAA Update                 Admin, AUC

   A STARTING SETUP, NOT A RULE IN CODE: administrators change any group in Edit
   Group afterwards. Which portfolios a user sees stays the group's Project
   visibility (Helpers/MultiYear/MultiYearAccess.cs).

   ADDITIVE AND IDEMPOTENT. Matched BY NAME, never by Id. It only adds: no grant
   is removed and no row is deleted. Run it ONCE per server (a re-run would add
   back a grant an administrator removed since). Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- Without the Phase 1 registration there is nothing to add to: NOEXEC skips the rest.
IF NOT EXISTS (SELECT 1 FROM dbo.tApiControllers WHERE ControllerName = N'MultiYearController')
BEGIN
    RAISERROR(N'Nothing changed: MultiYearController is not registered yet. Run Migration.MultiYear.Permissions.2026-10-31.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION;

DECLARE @Controller nvarchar(100) = N'MultiYearController';

DECLARE @Actions TABLE (ActionName nvarchar(50) PRIMARY KEY, Description nvarchar(200), Audience nvarchar(20));
INSERT INTO @Actions (ActionName, Description, Audience) VALUES
    (N'InitProposeForm',            N'Propose to RBP / UBP: programs and annual-project fields', N'Coordinator'),
    (N'ProposeToAnnualProgram',     N'Propose a planning project into an RBP / UBP',             N'Coordinator'),
    (N'DownloadPlanningTemplate',   N'Download the planning-project import template',           N'Coordinator'),
    (N'ImportPlanningProjects',     N'Import planning projects into an RDIP or UDIP',            N'Coordinator'),
    (N'ShowPipCandidates',          N'Add to PIP: the RDIP / UDIP projects that may enter',      N'PipManager'),
    (N'AddToPip',                   N'Add an RDIP / UDIP project to PIP',                         N'PipManager'),
    (N'SetPipCost',                 N'Change a project''s PIP cost',                              N'PipManager'),
    (N'ShowSavedTotals',            N'A portfolio''s saved totals',                               N'Read'),
    (N'SavedTotalsDetails',         N'One saved total, per project and year',                    N'Read'),
    (N'SaveTotals',                 N'Save a portfolio''s totals now',                            N'Writer'),
    (N'ShowUpdateRuns',             N'GAA Updates: the runs of the portfolio update',            N'Admin'),
    (N'RunGaaUpdate',               N'Run the portfolio update for a GAA year',                  N'Admin');

INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
SELECT a.ActionName, a.Description, @Controller
FROM @Actions a
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.tApiActions t
    WHERE t.ControllerName = @Controller
      AND t.ActionName COLLATE Latin1_General_BIN2 = a.ActionName COLLATE Latin1_General_BIN2);

/* ── Who gets what, by group name ──────────────────────────────────────────── */
DECLARE @Audience TABLE (Audience nvarchar(20), GroupName nvarchar(100));
INSERT INTO @Audience (Audience, GroupName)
SELECT a.Audience, g.GroupName
FROM (VALUES (N'Read'), (N'Writer'), (N'Admin'), (N'Coordinator'), (N'PipManager')) a (Audience)
CROSS APPLY (VALUES (N'Admin'), (N'AUC'), (N'DPD Admin'), (N'RPC'), (N'DPC'), (N'UPC'), (N'PPC')) g (GroupName)
WHERE (a.Audience = N'Read')
   OR (a.Audience = N'Writer'      AND g.GroupName IN (N'Admin', N'AUC', N'RPC', N'DPC', N'UPC', N'PPC'))
   OR (a.Audience = N'Admin'       AND g.GroupName IN (N'Admin', N'AUC'))
   OR (a.Audience = N'Coordinator' AND g.GroupName IN (N'Admin', N'AUC', N'RPC', N'DPC', N'UPC'))
   OR (a.Audience = N'PipManager'  AND g.GroupName IN (N'Admin', N'PPC'));

DECLARE @Grants TABLE (GroupId int, ActionId int);
INSERT INTO @Grants (GroupId, ActionId)
SELECT g.Id, act.Id
FROM @Audience au
JOIN dbo.tGroups g ON g.GroupName = au.GroupName
JOIN @Actions a ON a.Audience = au.Audience
JOIN dbo.tApiActions act ON act.ControllerName = @Controller AND act.ActionName = a.ActionName;

-- A granted group with no tGroupRoles row yet gets an empty one to merge into.
INSERT INTO dbo.tGroupRoles (GroupId, ActionIds, ViewIds)
SELECT DISTINCT gr.GroupId, N'[]', N'[]'
FROM @Grants gr
WHERE NOT EXISTS (SELECT 1 FROM dbo.tGroupRoles r WHERE r.GroupId = gr.GroupId);

/* ── Merge into each group's ActionIds (JSON int array): the union, nothing removed ── */
;WITH Merged AS (
    SELECT r.GroupId, x.Id
    FROM dbo.tGroupRoles r
    CROSS APPLY OPENJSON(r.ActionIds) WITH (Id int '$') x
    WHERE r.GroupId IN (SELECT GroupId FROM @Grants)
    UNION
    SELECT GroupId, ActionId FROM @Grants
)
UPDATE r
   SET r.ActionIds = N'[' + ISNULL(STUFF((
            SELECT N',' + CONVERT(nvarchar(12), m.Id)
            FROM Merged m WHERE m.GroupId = r.GroupId ORDER BY m.Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N''), N'') + N']'
FROM dbo.tGroupRoles r
WHERE r.GroupId IN (SELECT GroupId FROM @Grants);

COMMIT TRANSACTION;
GO

-- Verify: each group's Multi-Year actions.
SELECT g.GroupName,
       (SELECT COUNT(*) FROM OPENJSON(gr.ActionIds) WITH (Id int '$') x
          JOIN dbo.tApiActions a ON a.Id = x.Id WHERE a.ControllerName = N'MultiYearController') AS MultiYearActions
FROM dbo.tGroups g
JOIN dbo.tGroupRoles gr ON gr.GroupId = g.Id
ORDER BY g.Id;
GO

SET NOEXEC OFF;
GO
