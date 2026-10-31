/* =============================================================================
   Migration — Multi-Year module permissions
   Date: 2026-10-31
   Plan: documents/plans/multi-year-phase-1-portfolio-module.md
   -----------------------------------------------------------------------------
   Run AFTER Migration.MultiYear.Schema.2026-10-31.sql. It:

     1. registers MultiYearController and its 16 actions (tApiControllers,
        tApiActions) and the module's 4 pages (tAppViews), so neither Sync API nor
        Sync Routes has to run first;
     2. adds the App Module "MultiYear" and links the controller and pages to it,
        which is what makes them appear in User Management > Edit Group;
     3. MERGES default grants into tGroupRoles, by group name.

   A STARTING SETUP, NOT A RULE IN CODE. The application reads permissions only
   from tGroupRoles; after this script administrators change any group in Edit
   Group. Which portfolios a user SEES is not a grant: it is the group's Project
   visibility (Helpers/MultiYear/MultiYearAccess.cs).

     Pages: Portfolios, Portfolio, Project       Admin, AUC, DPD Admin, RPC, DPC, UPC, PPC
     Page: Add Planning Project                  Admin, AUC, RPC, DPC, UPC
     Reads                                       Admin, AUC, DPD Admin, RPC, DPC, UPC, PPC
     Create Portfolio, Open Next Term            Admin, AUC           (MY-PFL-05)
     Add / Update Planning Project,
       Update Membership, Save Budget Ceilings   Admin, AUC, RPC, DPC, UPC (coordinators)
     Set Membership Status                       Admin, AUC, RPC, DPC, UPC, PPC (MY-PFL-13)
     Show PIP                                    Admin, PPC           (MY-PFL-26; "All
                                                 projects" groups see PIP without it)
     Code lists                                  every group that holds
                                                 CodeTableController.UpdateCodeTable

   ADDITIVE AND IDEMPOTENT. Matched BY NAME, never by Id (Ids differ per
   database). It only adds: no grant is removed, no row is deleted, and a page or
   controller already linked to another App Module keeps that link. Running it
   again changes nothing -- unless an administrator removed one of these grants
   in Edit Group since, which a re-run would add back. So run it ONCE per server,
   like Migration.UserGroupAccessMatrix. Run by hand per environment. Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @Controller nvarchar(100) = N'MultiYearController';
DECLARE @Module     nvarchar(100) = N'MultiYear';

/* ── 1. Controller, actions, pages ─────────────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM dbo.tAppModules WHERE ModuleName = @Module)
    INSERT INTO dbo.tAppModules (ModuleName, Description) VALUES (@Module, N'Multi-Year portfolios: RDIP, UDIP and PIP over six-year terms');

IF NOT EXISTS (SELECT 1 FROM dbo.tApiControllers WHERE ControllerName = @Controller)
    INSERT INTO dbo.tApiControllers (ControllerName, Description, ModuleName) VALUES (@Controller, N'Multi-Year portfolios and planning projects', @Module);
ELSE
    UPDATE dbo.tApiControllers SET ModuleName = @Module WHERE ControllerName = @Controller AND ModuleName IS NULL;

DECLARE @Actions TABLE (ActionName nvarchar(50) PRIMARY KEY, Description nvarchar(200), Audience nvarchar(20));
INSERT INTO @Actions (ActionName, Description, Audience) VALUES
    (N'InitMultiYearFilters',       N'Portfolio filter and Create Portfolio sources',         N'Read'),
    (N'ShowPortfolios',             N'Portfolios the user can see',                           N'Read'),
    (N'PortfolioDetails',           N'One portfolio: term, yearly planned cost and ceilings', N'Read'),
    (N'ShowPortfolioMembers',       N'Paged projects of a portfolio',                         N'Read'),
    (N'MultiYearProjectDetails',    N'One multi-year project and its memberships',            N'Read'),
    (N'InitPlanningProjectForm',    N'Planning project form sources',                         N'Read'),
    (N'ShowPipPortfolios',          N'Show PIP: see the national PIP portfolios',             N'Pip'),
    (N'CreatePortfolio',            N'Create an RDIP, UDIP or PIP for a six-year term',       N'Admin'),
    (N'OpenNextTerm',               N'Open the next term and carry unfinished projects',      N'Admin'),
    (N'AddPlanningProject',         N'Add a planning project to an RDIP or UDIP',             N'Coordinator'),
    (N'UpdatePlanningProject',      N'Edit a planning project',                               N'Coordinator'),
    (N'UpdateMembership',           N'Edit a project''s planning fields in a portfolio',      N'Coordinator'),
    (N'SaveBudgetCeilings',         N'Record budget ceilings of a portfolio',                 N'Coordinator'),
    (N'SetMembershipStatus',        N'Set a project completed or cancelled in a portfolio',   N'Closer'),
    (N'ShowMultiYearCodeLists',     N'Multi-Year code lists (Code Tables)',                   N'CodeTables'),
    (N'SaveMultiYearCodeListItem',  N'Add or edit a Multi-Year code list value',              N'CodeTables');

INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
SELECT a.ActionName, a.Description, @Controller
FROM @Actions a
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.tApiActions t
    WHERE t.ControllerName = @Controller
      AND t.ActionName COLLATE Latin1_General_BIN2 = a.ActionName COLLATE Latin1_General_BIN2);

DECLARE @Views TABLE (RouteName nvarchar(100) PRIMARY KEY, RoutePath nvarchar(200), Description nvarchar(200), Audience nvarchar(20));
INSERT INTO @Views (RouteName, RoutePath, Description, Audience) VALUES
    (N'MultiYearPortfolios',       N'/multi-year/portfolios',                          N'Multi-Year: Portfolios',           N'Read'),
    (N'MultiYearPortfolioDetails', N'/multi-year/portfolios/:portfolioId',             N'Multi-Year: Portfolio',            N'Read'),
    (N'MultiYearAddProject',       N'/multi-year/portfolios/:portfolioId/add-project', N'Multi-Year: Add Planning Project', N'Coordinator'),
    (N'MultiYearProjectDetails',   N'/multi-year/projects/:projectId',                 N'Multi-Year: Project',              N'Read');

INSERT INTO dbo.tAppViews (RouteName, RoutePath, Description, ModuleName)
SELECT v.RouteName, v.RoutePath, v.Description, @Module
FROM @Views v
WHERE NOT EXISTS (SELECT 1 FROM dbo.tAppViews t WHERE t.RouteName = v.RouteName);

UPDATE t SET t.ModuleName = @Module
FROM dbo.tAppViews t JOIN @Views v ON v.RouteName = t.RouteName
WHERE t.ModuleName IS NULL;

/* ── 2. Who gets what, by group name ───────────────────────────────────────── */
DECLARE @Audience TABLE (Audience nvarchar(20), GroupName nvarchar(100));
INSERT INTO @Audience (Audience, GroupName)
SELECT a.Audience, g.GroupName
FROM (VALUES (N'Read'), (N'Pip'), (N'Admin'), (N'Coordinator'), (N'Closer')) a (Audience)
CROSS APPLY (VALUES (N'Admin'), (N'AUC'), (N'DPD Admin'), (N'RPC'), (N'DPC'), (N'UPC'), (N'PPC')) g (GroupName)
WHERE (a.Audience = N'Read')
   OR (a.Audience = N'Pip'         AND g.GroupName IN (N'Admin', N'PPC'))
   OR (a.Audience = N'Admin'       AND g.GroupName IN (N'Admin', N'AUC'))
   OR (a.Audience = N'Coordinator' AND g.GroupName IN (N'Admin', N'AUC', N'RPC', N'DPC', N'UPC'))
   OR (a.Audience = N'Closer'      AND g.GroupName IN (N'Admin', N'AUC', N'RPC', N'DPC', N'UPC', N'PPC'));

-- Code lists: whoever already maintains Code Tables.
INSERT INTO @Audience (Audience, GroupName)
SELECT DISTINCT N'CodeTables', g.GroupName
FROM dbo.tGroups g
JOIN dbo.tGroupRoles gr ON gr.GroupId = g.Id
CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId int '$') j
JOIN dbo.tApiActions act ON act.Id = j.ActionId
WHERE act.ControllerName = N'CodeTableController' AND act.ActionName = N'UpdateCodeTable';

DECLARE @Grants TABLE (GroupId int, ActionId int NULL, ViewId int NULL);
INSERT INTO @Grants (GroupId, ActionId)
SELECT g.Id, act.Id
FROM @Audience au
JOIN dbo.tGroups g ON g.GroupName = au.GroupName
JOIN @Actions a ON a.Audience = au.Audience
JOIN dbo.tApiActions act ON act.ControllerName = @Controller AND act.ActionName = a.ActionName;
INSERT INTO @Grants (GroupId, ViewId)
SELECT g.Id, vw.Id
FROM @Audience au
JOIN dbo.tGroups g ON g.GroupName = au.GroupName
JOIN @Views v ON v.Audience = au.Audience
JOIN dbo.tAppViews vw ON vw.RouteName = v.RouteName;

-- A granted group with no tGroupRoles row yet gets an empty one to merge into.
INSERT INTO dbo.tGroupRoles (GroupId, ActionIds, ViewIds)
SELECT DISTINCT gr.GroupId, N'[]', N'[]'
FROM @Grants gr
WHERE NOT EXISTS (SELECT 1 FROM dbo.tGroupRoles r WHERE r.GroupId = gr.GroupId);

/* ── 3. Merge into each group's ActionIds / ViewIds (JSON int arrays) ─────────
      The union of what the group has and what it is granted; nothing removed. */
;WITH Merged AS (
    SELECT r.GroupId, x.Id
    FROM dbo.tGroupRoles r
    CROSS APPLY OPENJSON(r.ActionIds) WITH (Id int '$') x
    WHERE r.GroupId IN (SELECT GroupId FROM @Grants WHERE ActionId IS NOT NULL)
    UNION
    SELECT GroupId, ActionId FROM @Grants WHERE ActionId IS NOT NULL
)
UPDATE r
   SET r.ActionIds = N'[' + ISNULL(STUFF((
            SELECT N',' + CONVERT(nvarchar(12), m.Id)
            FROM Merged m WHERE m.GroupId = r.GroupId ORDER BY m.Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N''), N'') + N']'
FROM dbo.tGroupRoles r
WHERE r.GroupId IN (SELECT GroupId FROM @Grants WHERE ActionId IS NOT NULL);

;WITH Merged AS (
    SELECT r.GroupId, x.Id
    FROM dbo.tGroupRoles r
    CROSS APPLY OPENJSON(r.ViewIds) WITH (Id int '$') x
    WHERE r.GroupId IN (SELECT GroupId FROM @Grants WHERE ViewId IS NOT NULL)
    UNION
    SELECT GroupId, ViewId FROM @Grants WHERE ViewId IS NOT NULL
)
UPDATE r
   SET r.ViewIds = N'[' + ISNULL(STUFF((
            SELECT N',' + CONVERT(nvarchar(12), m.Id)
            FROM Merged m WHERE m.GroupId = r.GroupId ORDER BY m.Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N''), N'') + N']'
FROM dbo.tGroupRoles r
WHERE r.GroupId IN (SELECT GroupId FROM @Grants WHERE ViewId IS NOT NULL);

COMMIT TRANSACTION;
GO

-- Verify: each group's Multi-Year actions and pages.
SELECT g.GroupName,
       (SELECT COUNT(*) FROM OPENJSON(gr.ActionIds) WITH (Id int '$') x
          JOIN dbo.tApiActions a ON a.Id = x.Id WHERE a.ControllerName = N'MultiYearController') AS MultiYearActions,
       (SELECT COUNT(*) FROM OPENJSON(gr.ViewIds) WITH (Id int '$') x
          JOIN dbo.tAppViews v ON v.Id = x.Id WHERE v.ModuleName = N'MultiYear') AS MultiYearPages
FROM dbo.tGroups g
JOIN dbo.tGroupRoles gr ON gr.GroupId = g.Id
ORDER BY g.Id;
GO
