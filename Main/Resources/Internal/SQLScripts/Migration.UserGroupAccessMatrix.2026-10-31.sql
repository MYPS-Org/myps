/* =============================================================================
   Migration — user group permissions follow the client's access matrix
   Date: 2026-10-31 · Source: docs/USERGROUPACCESS.xlsx, sheet "Client" (kept local)
   -----------------------------------------------------------------------------
   Sets what the matrix roles may do. Roles → MYPS groups, by GroupName:
     AUC → AUC          DPDA → DPD Admin    DPDC → DPDC/PDC    PDC → PDC
     PDA → PDA          PPC  → PPC          RPO  → RPO         RPC → RPC
     DPC → DPC          UPC  → UPC          VIEW → VIEW (created here if missing)
   The DPDC and PDC columns are identical, so DPDC/PDC and PDC get the same rights.

   Each matrix row with a MYPS counterpart is a FEATURE: a set of API actions and
   pages. A matrix group gets a feature only where the matrix ticks it. Every matrix
   group also gets BASE: viewing programs, projects, project groups, revisions,
   future infrastructure and reports ("Other Reports" is ticked for every role).

     new rights = (current rights − every FEATURE action/page)
                  ∪ BASE ∪ the FEATUREs the matrix ticks

   So rights the matrix does not speak to are KEPT as they are: Lump Sum, revision
   approval (RPC/AUC), login history. Admin, SD and the E2E groups are not matrix
   roles and are not touched. AUC gets every feature.

   Not mapped (no MYPS counterpart yet, or "?"/"For clarification" in the matrix):
   Submit Annual Proposal, Submit / Unlock / Manage NEP and HGAB Revisions,
   Synchronize PIP, Calculate EAO, Archive/Restore Program, Change Project Status,
   Conduct MCA, Project Profile, Republish Project Group, Manage MCA Groups, Manage
   Report Groups. The RDC, PIP, Investment and BED/BARG/PGS reports are not separate
   reports in MYPS; RBP, RBP Summary and the extracts count as "Other Reports".

   Matched BY NAME, never by Id (Ids differ per database). Idempotent. Run by hand
   per environment, like the other Migration.* scripts; it prints what it changes.
   The application also gates the AIP reports on ReportingController.
   RequestReportAIPOfficial (Reports page, 2026-10-31).
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

/* 0. The VIEW group, and a role row for every matrix group. */
IF NOT EXISTS (SELECT 1 FROM dbo.tGroups WHERE GroupName = N'VIEW')
    INSERT INTO dbo.tGroups (GroupName, Description, ApplyFilter, CreatedBy, CreatedDate)
    VALUES (N'VIEW', N'View only: programs, projects and the general reports.', 1, N'Migration', GETDATE());

DECLARE @MatrixGroup TABLE (GroupName nvarchar(100) PRIMARY KEY, Role varchar(10));
INSERT INTO @MatrixGroup VALUES
    (N'AUC','AUC'), (N'DPD Admin','DPDA'), (N'DPDC/PDC','DPDC'), (N'PDC','PDC'), (N'PDA','PDA'),
    (N'PPC','PPC'), (N'RPO','RPO'), (N'RPC','RPC'), (N'DPC','DPC'), (N'UPC','UPC'), (N'VIEW','VIEW');

INSERT INTO dbo.tGroupRoles (GroupId, ActionIds, ViewIds)
SELECT g.Id, N'[]', N'[]'
FROM dbo.tGroups g JOIN @MatrixGroup m ON m.GroupName = g.GroupName
WHERE NOT EXISTS (SELECT 1 FROM dbo.tGroupRoles r WHERE r.GroupId = g.Id);

/* 1. Features: API actions. */
DECLARE @FeatureAction TABLE (Feature varchar(30), ControllerName nvarchar(100), ActionName nvarchar(100));
INSERT INTO @FeatureAction VALUES
    -- BASE: reading (every matrix group)
    ('BASE','AuthController','Login'), ('BASE','AuthController','Logout'), ('BASE','AuthController','Validate'),
    ('BASE','GlobalSearchController','GetSearchCategory'), ('BASE','GlobalSearchController','Search'),
    ('BASE','ProgramController','InitAddProgram'), ('BASE','ProgramController','InitFilterProgram'),
    ('BASE','ProgramController','ProgramDetails'), ('BASE','ProgramController','ShowProgram'),
    ('BASE','ProgramController','ShowProgramStages'), ('BASE','ProgramController','ShowProjectsInProgram'),
    ('BASE','ProjectController','SearchProgram'), ('BASE','ProjectController','ShowProjectComponentDropdowns'),
    ('BASE','ProjectController','ShowProjectDetails'), ('BASE','ProjectController','ShowProjectDropdowns'),
    ('BASE','ProjectController','ShowProjects'), ('BASE','ProjectController','ShowProjectStages'),
    ('BASE','ProjectController','ShowProjectStageTargets'), ('BASE','ProjectController','ShowProjectTargetComponents'),
    ('BASE','ProjectGroupController','ShowProjectGroups'), ('BASE','ProjectGroupController','ProjectGroupDetails'),
    ('BASE','ProjectGroupController','SearchProject'),
    ('BASE','FutureInfraController','GetInfraInfo'),
    ('BASE','FutureInfraController','InitFilterFutureBridge'), ('BASE','FutureInfraController','InitFilterFutureRoads'),
    ('BASE','FutureInfraController','InitFilterFutureRoadSections'), ('BASE','FutureInfraController','ShowFutureBridge'),
    ('BASE','FutureInfraController','ShowFutureRoads'), ('BASE','FutureInfraController','ShowFutureRoadSections'),
    ('BASE','FutureInfraController','ShowInfraBridges'), ('BASE','FutureInfraController','ShowInfraRoadSections'),
    ('BASE','RevisionController','RevisionRequests'), ('BASE','RevisionController','ViewReviseProject'),
    ('BASE','RevisionController','RevisionEnums'), ('BASE','RevisionController','ShowRevisionStatusDropdown'),
    ('BASE','ReportingController','GetAIPReportDropdowns'), ('BASE','ReportingController','GetRBPReportDropdowns'),
    ('BASE','ReportingController','GetRDIPReportDropdowns'),
    -- PROGRAMS
    ('PROGRAM_CREATE','ProgramController','AddProgram'),
    ('PROGRAM_EDIT','ProgramController','UpdateProgramDetails'),
    ('PROGRAM_DELETE','ProgramController','DeleteProgram'), ('PROGRAM_DELETE','ProgramController','DeleteProgramStage'),
    ('PROGRAM_STATUS','ProgramController','UpdateProgramStage'),
    ('PROGRAM_PUBLISH','PCMAController','PublishProgram'),
    ('PROGRAM_EXPORT','ImportingController','ExportProjects'), ('PROGRAM_EXPORT','ImportingController','GetImportStatus'),
    ('PROGRAM_EXPORT','ImportingController','DownloadImportFile'),
    -- PROJECTS
    ('PROJECT_ADD','ProjectController','AddProject'),
    ('PROJECT_EDIT','ProjectController','UpdateProjectDetails'),
    ('PROJECT_DELETE','ProgramController','BatchDelete'), ('PROJECT_DELETE','ProgramController','PreviewBatchDelete'),
    ('PROJECT_DELETE','ProgramController','ShowDeletedProjects'), ('PROJECT_DELETE','ProgramController','RestoreToCurrentStage'),
    ('PROJECT_REVISE','RevisionController','ReviseProject'), ('PROJECT_REVISE','RevisionController','RequestRevision'),
    ('PROJECT_REVISE','RevisionController','ResubmitRevision'),
    ('PROJECT_IMPORT','ImportingController','ImportProject'), ('PROJECT_IMPORT','ImportingController','UpdateProject'),
    ('PROJECT_IMPORT','ImportingController','DownloadTemplate'), ('PROJECT_IMPORT','ImportingController','GetImportStatus'),
    ('PROJECT_IMPORT','ImportingController','DownloadImportFile'),
    ('PROJECT_COPY','ProgramController','BatchAddExistingProject'),
    ('PROJECT_PUBLISH','ProgramController','BatchAllowPublish'),
    ('PROJECT_DONOTPUBLISH','ProgramController','BatchRestrictPublish'),
    ('PROJECT_NOTES','ProjectController','UploadSupportingDocs'), ('PROJECT_NOTES','ProjectController','DeleteSupportingDocs'),
    -- PROJECT GROUPS
    ('PG_MANAGE','ProjectGroupController','AddProjectGroup'), ('PG_MANAGE','ProjectGroupController','UpdateProjectGroupDetails'),
    ('PG_MANAGE','ProjectGroupController','DeleteProjectGroup'), ('PG_MANAGE','ProjectGroupController','AddProject'),
    ('PG_MANAGE','ProjectGroupController','DeleteProject'),
    -- REPORTS
    ('REPORT_AIP','ReportingController','RequestReportAIP'), ('REPORT_AIP','ReportingController','RequestReportAIP02'),
    ('REPORT_AIP','ReportingController','RequestReportAIPOfficial'),
    ('REPORT_OTHER','ReportingController','RequestReportRBP'), ('REPORT_OTHER','ReportingController','RequestReportRBPComponents'),
    ('REPORT_OTHER','ReportingController','RequestReportRBPTier'), ('REPORT_OTHER','ReportingController','RequestReportRDIP'),
    ('REPORT_OTHER','ReportingController','RequestRawProjects'),
    -- ADMINISTRATION
    ('INFRA_EDIT','FutureInfraController','AddFutureBridge'), ('INFRA_EDIT','FutureInfraController','AddFutureRoads'),
    ('INFRA_EDIT','FutureInfraController','AddFutureRoadSections'), ('INFRA_EDIT','FutureInfraController','EditFutureBridge'),
    ('INFRA_EDIT','FutureInfraController','EditFutureRoads'), ('INFRA_EDIT','FutureInfraController','EditFutureRoadSections'),
    ('INFRA_EDIT','FutureInfraController','DeleteFutureBridg'), ('INFRA_EDIT','FutureInfraController','DeleteFutureRoad'),
    ('INFRA_EDIT','FutureInfraController','DeleteFutureRoadSection'),
    ('CODE_TABLES','CodeTableController','GetAllCodeTables'), ('CODE_TABLES','CodeTableController','GetAdminAreas'),
    ('CODE_TABLES','CodeTableController','GetTransactionLog'), ('CODE_TABLES','CodeTableController','UpdateCodeTable');
-- MYPS User Permissions: every User Management action.
INSERT INTO @FeatureAction
SELECT 'USER_MANAGEMENT', ControllerName, ActionName FROM dbo.tApiActions WHERE ControllerName = N'UserManagementController';

/* 2. Features: pages. */
DECLARE @FeatureView TABLE (Feature varchar(30), RouteName nvarchar(100));
INSERT INTO @FeatureView VALUES
    ('BASE','Dashboard'), ('BASE','ProgramList'), ('BASE','ProgramDetails'), ('BASE','ProjectList'),
    ('BASE','ProjectDetails'), ('BASE','RevisionList'), ('BASE','RevisionView'), ('BASE','ProjectGroupList'),
    ('BASE','ProjectGroupDetails'), ('BASE','InfraManagement'), ('BASE','Settings'), ('BASE','Reports'),
    ('PROJECT_ADD','AddProject'),
    ('PROJECT_REVISE','RevisionDetails'),
    ('USER_MANAGEMENT','UserManagement'),
    ('CODE_TABLES','CodeTables');

/* 3. The matrix ("Client" sheet). AUC has every feature. */
DECLARE @RoleFeature TABLE (Role varchar(10), Feature varchar(30));
INSERT INTO @RoleFeature
SELECT m.Role, f.Feature
FROM @MatrixGroup m
CROSS JOIN (VALUES ('BASE'), ('REPORT_OTHER')) f(Feature);              -- every role
INSERT INTO @RoleFeature
SELECT 'AUC', Feature FROM (SELECT Feature FROM @FeatureAction UNION SELECT Feature FROM @FeatureView) a
WHERE Feature NOT IN ('BASE', 'REPORT_OTHER');
INSERT INTO @RoleFeature (Role, Feature)
SELECT r.Role, f.Feature
FROM (VALUES
    -- Create / Edit / Delete Program, Change program Status, Publish Program
    ('PROGRAM_CREATE','DPDA,PDA'), ('PROGRAM_EDIT','DPDA,PDA'), ('PROGRAM_DELETE','DPDA,PDA'),
    ('PROGRAM_STATUS','DPDA,PDA'), ('PROGRAM_PUBLISH','DPDA,PDA'),
    -- Export Program
    ('PROGRAM_EXPORT','DPDA,DPDC,PDA,PDC,PPC,RPC,DPC,UPC'),
    -- Add / Edit / Delete a Project, Import, Copy to a Program, Remove all Projects
    ('PROJECT_ADD','DPDA,DPDC,PDA,PDC,PPC,RPO,RPC,DPC,UPC'), ('PROJECT_EDIT','DPDA,DPDC,PDA,PDC,PPC,RPO,RPC,DPC,UPC'),
    ('PROJECT_DELETE','DPDA,DPDC,PDA,PDC,PPC,RPO,RPC,DPC,UPC'), ('PROJECT_IMPORT','DPDA,DPDC,PDA,PDC,PPC,RPO,RPC,DPC,UPC'),
    ('PROJECT_COPY','DPDA,DPDC,PDA,PDC,PPC,RPO,RPC,DPC,UPC'),
    -- Revise a Project
    ('PROJECT_REVISE','DPDA,DPDC,PDA,PDC,RPC,DPC,UPC'),
    -- Publish Project / Do Not Publish
    ('PROJECT_PUBLISH','DPDA,DPDC,PDA,PDC'), ('PROJECT_DONOTPUBLISH','DPDA,PDA'),
    -- Project Notes (now Supporting Documents)
    ('PROJECT_NOTES','DPDA,DPDC,PDA,PDC,PPC,RPC,DPC,UPC'),
    -- Create / Edit / Delete Project Group
    ('PG_MANAGE','DPDA,PDA'),
    -- Annual Infrastructure Program report
    ('REPORT_AIP','DPDA,PDA'),
    -- Future Infra, Code Tables (MYPS User Permissions: AUC only)
    ('INFRA_EDIT','DPDA'), ('CODE_TABLES','DPDA,PDA')
) f(Feature, Roles)
CROSS APPLY (SELECT LTRIM(value) AS Role FROM STRING_SPLIT(f.Roles, ',')) r;

/* 4. Resolve to Ids. An action or page missing from this database is reported, not invented. */
SELECT DISTINCT fa.Feature, fa.ControllerName + N'.' + fa.ActionName AS NotRegistered
FROM @FeatureAction fa
WHERE NOT EXISTS (SELECT 1 FROM dbo.tApiActions a WHERE a.ControllerName = fa.ControllerName AND a.ActionName = fa.ActionName)
UNION ALL
SELECT fv.Feature, fv.RouteName
FROM @FeatureView fv
WHERE NOT EXISTS (SELECT 1 FROM dbo.tAppViews v WHERE v.RouteName = fv.RouteName);

DECLARE @ActionFeature TABLE (ActionId int, Feature varchar(30));
INSERT INTO @ActionFeature
SELECT DISTINCT a.Id, fa.Feature FROM @FeatureAction fa
JOIN dbo.tApiActions a ON a.ControllerName = fa.ControllerName AND a.ActionName = fa.ActionName;

DECLARE @ViewFeature TABLE (ViewId int, Feature varchar(30));
INSERT INTO @ViewFeature
SELECT DISTINCT v.Id, fv.Feature FROM @FeatureView fv JOIN dbo.tAppViews v ON v.RouteName = fv.RouteName;

/* 5. New rights per matrix group: kept (outside every feature) ∪ granted features. */
DECLARE @NewAction TABLE (GroupId int, ActionId int);
INSERT INTO @NewAction
SELECT gr.GroupId, cur.ActionId
FROM dbo.tGroupRoles gr
JOIN dbo.tGroups g ON g.Id = gr.GroupId
JOIN @MatrixGroup m ON m.GroupName = g.GroupName
CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId int '$') cur
WHERE NOT EXISTS (SELECT 1 FROM @ActionFeature af WHERE af.ActionId = cur.ActionId)
UNION
SELECT g.Id, af.ActionId
FROM dbo.tGroups g
JOIN @MatrixGroup m ON m.GroupName = g.GroupName
JOIN @RoleFeature rf ON rf.Role = m.Role
JOIN @ActionFeature af ON af.Feature = rf.Feature;

DECLARE @NewView TABLE (GroupId int, ViewId int);
INSERT INTO @NewView
SELECT gr.GroupId, cur.ViewId
FROM dbo.tGroupRoles gr
JOIN dbo.tGroups g ON g.Id = gr.GroupId
JOIN @MatrixGroup m ON m.GroupName = g.GroupName
CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId int '$') cur
WHERE NOT EXISTS (SELECT 1 FROM @ViewFeature vf WHERE vf.ViewId = cur.ViewId)
UNION
SELECT g.Id, vf.ViewId
FROM dbo.tGroups g
JOIN @MatrixGroup m ON m.GroupName = g.GroupName
JOIN @RoleFeature rf ON rf.Role = m.Role
JOIN @ViewFeature vf ON vf.Feature = rf.Feature;

/* 6. What changes (before the update). */
SELECT g.GroupName, d.Change, d.Name
FROM (
    SELECT n.GroupId, 'granted' AS Change, a.ControllerName + N'.' + a.ActionName AS Name
    FROM @NewAction n JOIN dbo.tApiActions a ON a.Id = n.ActionId
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tGroupRoles gr CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId int '$') c
                      WHERE gr.GroupId = n.GroupId AND c.ActionId = n.ActionId)
    UNION ALL
    SELECT gr.GroupId, 'removed', a.ControllerName + N'.' + a.ActionName
    FROM dbo.tGroupRoles gr
    JOIN dbo.tGroups g2 ON g2.Id = gr.GroupId JOIN @MatrixGroup m ON m.GroupName = g2.GroupName
    CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId int '$') c
    JOIN dbo.tApiActions a ON a.Id = c.ActionId
    WHERE NOT EXISTS (SELECT 1 FROM @NewAction n WHERE n.GroupId = gr.GroupId AND n.ActionId = c.ActionId)
    UNION ALL
    SELECT n.GroupId, 'page granted', v.RouteName
    FROM @NewView n JOIN dbo.tAppViews v ON v.Id = n.ViewId
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tGroupRoles gr CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId int '$') c
                      WHERE gr.GroupId = n.GroupId AND c.ViewId = n.ViewId)
    UNION ALL
    SELECT gr.GroupId, 'page removed', v.RouteName
    FROM dbo.tGroupRoles gr
    JOIN dbo.tGroups g2 ON g2.Id = gr.GroupId JOIN @MatrixGroup m ON m.GroupName = g2.GroupName
    CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId int '$') c
    JOIN dbo.tAppViews v ON v.Id = c.ViewId
    WHERE NOT EXISTS (SELECT 1 FROM @NewView n WHERE n.GroupId = gr.GroupId AND n.ViewId = c.ViewId)
) d
JOIN dbo.tGroups g ON g.Id = d.GroupId
ORDER BY g.GroupName, d.Change, d.Name;

/* 7. Apply. */
UPDATE gr
SET ActionIds = ISNULL((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(12), n.ActionId), N',') WITHIN GROUP (ORDER BY n.ActionId) + N']'
                        FROM @NewAction n WHERE n.GroupId = gr.GroupId), N'[]'),
    ViewIds   = ISNULL((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(12), n.ViewId), N',') WITHIN GROUP (ORDER BY n.ViewId) + N']'
                        FROM @NewView n WHERE n.GroupId = gr.GroupId), N'[]')
FROM dbo.tGroupRoles gr
JOIN dbo.tGroups g ON g.Id = gr.GroupId
JOIN @MatrixGroup m ON m.GroupName = g.GroupName;

COMMIT TRANSACTION;
GO

/* 8. Verify: rights per matrix group and feature (Y = every action and page of the feature). */
SELECT g.GroupName,
       COUNT(DISTINCT c.ActionId) AS Actions,
       (SELECT COUNT(*) FROM OPENJSON(gr.ViewIds)) AS Pages
FROM dbo.tGroups g
JOIN dbo.tGroupRoles gr ON gr.GroupId = g.Id
OUTER APPLY OPENJSON(gr.ActionIds) WITH (ActionId int '$') c
WHERE g.GroupName IN (N'AUC', N'DPD Admin', N'DPDC/PDC', N'PDC', N'PDA', N'PPC', N'RPO', N'RPC', N'DPC', N'UPC', N'VIEW')
GROUP BY g.GroupName, gr.ViewIds
ORDER BY g.GroupName;
GO
