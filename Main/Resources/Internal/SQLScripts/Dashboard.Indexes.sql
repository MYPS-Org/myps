/*
    MYPS dashboard supporting indexes

    Every dashboard endpoint (WebAPI/Controllers/Dashboard/DashboardController.cs)
    scopes its aggregate to one fiscal year with

        WHERE cy.IsDeleted = 0 AND cy.[Year] = @year

    over dbo.tProjectComponentCostPerYear. That table carried indexes on Id
    (clustered PK) and ComponentCostFK only, so the year predicate had no seek
    available and every dashboard section full-scanned roughly 3.5 million rows.

    This script adds the covering index that predicate needs. Measured on a
    56,789-project development database: the regional aggregate went from
    3,013 ms / 17,721 ms CPU to 284 ms / 2,530 ms CPU.

    Deployment:
      This repo has no migration runner for database objects. Apply this script
      to the target database by hand, exactly as Revision.Queue.sql and
      Project.StageTargets.sql are handled. It is idempotent and safe to re-run:
      it only creates an index if that index is absent, and drops nothing.

      The session running it must have QUOTED_IDENTIFIER ON (SSMS and
      sqlcmd -I both do); filtered indexes cannot be created otherwise.

    Index shape:
      - Key on [Year] alone: the dashboard always filters one exact year, and
        the table has no other query pattern that leads with Year.
      - INCLUDE (ComponentCostFK, Amount) so the aggregate is answered entirely
        from this index — ComponentCostFK for the join up to
        tProjectComponentCost, Amount for the SUM. No key lookups.
      - Filtered to IsDeleted = 0, matching this database's existing "_Live"
        filtered-index convention (IX_tProjectComponentCostPerYear_Live,
        IX_tProjectComponentCost_Live) and keeping the index off soft-deleted
        rows the dashboard never reads.

    Write cost:
      One extra narrow index on an insert-heavy import table. Accepted: imports
      write this table in bulk a few times per cycle, while the dashboard reads
      it on every page load.
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_tProjectComponentCostPerYear_Year_Live'
      AND object_id = OBJECT_ID(N'dbo.tProjectComponentCostPerYear')
)
BEGIN
    PRINT 'Creating IX_tProjectComponentCostPerYear_Year_Live...';

    CREATE NONCLUSTERED INDEX IX_tProjectComponentCostPerYear_Year_Live
        ON dbo.tProjectComponentCostPerYear ([Year])
        INCLUDE (ComponentCostFK, Amount)
        WHERE IsDeleted = 0;

    PRINT 'Created IX_tProjectComponentCostPerYear_Year_Live.';
END
ELSE
BEGIN
    PRINT 'IX_tProjectComponentCostPerYear_Year_Live already exists - nothing to do.';
END
GO
