/* =============================================================================
   Migration — Project visibility is a user group setting (tGroups.ProjectScope)
   Date: 2026-10-31
   -----------------------------------------------------------------------------
   Which projects a group's members see was fixed by group NAME in the code
   (Helpers/ProjectHelper.cs): AUC and DPD Admin everything, RPC their region,
   DPC their district office, every other group the program Data Security rule.
   This adds the setting that User Management > User Groups > Edit Group now
   shows as "Project visibility":

     0  By program Data Security  (with Apply Filter: the programs whose Data
                                   Security Access includes the user's region)
     1  All projects
     2  Own region                (every district office of the region that is
                                   the user's Plantilla Office)
     3  Own district office       (the district office that is the user's
                                   Plantilla Office)

   ADDITIVE, AND IT CHANGES WHAT NO ONE SEES: when the column is first added, each
   group gets the scope its name gave it until now (AUC, DPD Admin = 1; RPC = 2;
   DPC = 3; the rest = 0). Running it again changes nothing: the seed runs only in
   the batch that adds the column, so settings made in Edit Group are kept.

   The application works before this runs (it falls back to the names, and Edit
   Group refuses a change of Project visibility until then), so it can run before
   or after the deployment. Run by hand per environment, like the other
   Migration.* scripts. Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF COL_LENGTH('dbo.tGroups', 'ProjectScope') IS NULL
BEGIN
    ALTER TABLE dbo.tGroups ADD ProjectScope tinyint NOT NULL
        CONSTRAINT DF_tGroups_ProjectScope DEFAULT (0)
        CONSTRAINT CK_tGroups_ProjectScope CHECK (ProjectScope BETWEEN 0 AND 3);

    -- The scope each group had by name (Helpers.GroupProjectScopes.ByName). Dynamic SQL: the column
    -- does not exist when this batch is compiled.
    EXEC (N'
        UPDATE dbo.tGroups SET ProjectScope = 1 WHERE GroupName IN (N''AUC'', N''DPD Admin'');
        UPDATE dbo.tGroups SET ProjectScope = 2 WHERE GroupName = N''RPC'';
        UPDATE dbo.tGroups SET ProjectScope = 3 WHERE GroupName = N''DPC'';');
END

COMMIT TRANSACTION;
GO

-- Verify: every group and its Project visibility.
SELECT Id, GroupName, ApplyFilter,
       ProjectScope,
       CASE ProjectScope WHEN 0 THEN 'By program Data Security' WHEN 1 THEN 'All projects'
                         WHEN 2 THEN 'Own region' WHEN 3 THEN 'Own district office' END AS ProjectVisibility
FROM dbo.tGroups
ORDER BY Id;
GO
