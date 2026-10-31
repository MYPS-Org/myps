/* =============================================================================
   Migration — Project visibility gains "Own UPMO cluster" (tGroups.ProjectScope = 4)
   Date: 2026-10-31
   Plan: documents/plans/multi-year-phase-1-portfolio-module.md
   -----------------------------------------------------------------------------
   The first run of Migration.GroupProjectScope.2026-10-31.sql allowed
   ProjectScope 0-3. The Multi-Year module adds a fifth choice:

     4  Own UPMO cluster   (the UDIP portfolio of the PMO cluster office that is
                            the user's Plantilla Office; every UDIP for the UPMO
                            itself. Projects: as By program Data Security.)

   This only widens the check constraint from 0-3 to 0-4. No row changes and no
   group's setting changes: a group gets Own UPMO cluster only when an
   administrator chooses it in Edit Group. Until this runs, Edit Group refuses
   that one choice with a message naming this script; everything else works.

   Only a server where Migration.GroupProjectScope ran BEFORE 2026-10-31 evening
   needs this. That script now creates the column with 0-4 already, so on a
   server that runs it fresh this script finds nothing to do.

   Run AFTER Migration.GroupProjectScope.2026-10-31.sql. When the column is not
   there yet this script changes nothing and says so (every statement that names
   the column is dynamic SQL, so the batch compiles without it).
   Idempotent: it does nothing when the constraint already allows 4. Run by hand
   per environment, like the other Migration.* scripts. Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH('dbo.tGroups', 'ProjectScope') IS NULL
BEGIN
    RAISERROR(N'Nothing changed: tGroups.ProjectScope does not exist on this database yet. Run Migration.GroupProjectScope.2026-10-31.sql (it creates the column with 0-4); this script is then not needed.', 16, 1);
    RETURN;
END

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_tGroups_ProjectScope'
                 AND parent_object_id = OBJECT_ID(N'dbo.tGroups')
                 AND definition LIKE N'%<=(4)%')
BEGIN
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_tGroups_ProjectScope' AND parent_object_id = OBJECT_ID(N'dbo.tGroups'))
        ALTER TABLE dbo.tGroups DROP CONSTRAINT CK_tGroups_ProjectScope;

    EXEC (N'ALTER TABLE dbo.tGroups WITH CHECK
        ADD CONSTRAINT CK_tGroups_ProjectScope CHECK (ProjectScope BETWEEN 0 AND 4);');

    COMMIT TRANSACTION;
END
GO

-- Verify: the constraint now reads 0-4, and every group keeps its setting.
IF COL_LENGTH('dbo.tGroups', 'ProjectScope') IS NOT NULL
BEGIN
    SELECT name, definition FROM sys.check_constraints WHERE name = N'CK_tGroups_ProjectScope';
    EXEC (N'SELECT Id, GroupName, ProjectScope FROM dbo.tGroups ORDER BY Id;');
END
GO
