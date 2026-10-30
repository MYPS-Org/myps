/* =============================================================================
   Migration — Code Tables → Revisions → Validation Dates are saved, and enforced
   Date: 2026-10-30 · UAT S04-TC016-P001 · Plan: documents/plans/s04-code-tables-completion.md
   -----------------------------------------------------------------------------
   The Validation Dates screen showed built-in sample rows, and Add / Edit / Delete
   changed only the page: nothing was saved, and a reload brought the samples back.

   This creates dbo.tOptionRevisionValidationDate: one row per funding year (the
   program year a project was appropriated in), with the dates between which a
   revision of that year's projects can be requested. RequestRevision refuses a new
   request outside the window of the project's program year; a year with no row, or
   an Inactive row, has no window. A request already returned For Correction can
   still be resubmitted.

   Starts EMPTY on purpose: the old sample rows (2016 to 2024) were placeholders, and
   seeding them would start refusing revisions on deployment. PS Admin enters the
   real windows in Code Tables.

   The API tolerates the table being absent (the screen shows no rows and nothing is
   enforced), so this can run before or after the deployment. Idempotent; run by
   hand per environment, like the other Migration.* scripts. Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.tOptionRevisionValidationDate', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tOptionRevisionValidationDate (
        Id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionRevisionValidationDate PRIMARY KEY,
        FundingYear  INT           NOT NULL,
        StartDate    DATETIME2(0)  NOT NULL,
        EndDate      DATETIME2(0)  NOT NULL,
        IsActive     BIT           NOT NULL CONSTRAINT DF_tOptionRevisionValidationDate_IsActive DEFAULT (1),
        CreatedBy    NVARCHAR(50)  NOT NULL CONSTRAINT DF_tOptionRevisionValidationDate_CreatedBy DEFAULT (N''),
        CreatedDate  DATETIME2(0)  NOT NULL CONSTRAINT DF_tOptionRevisionValidationDate_CreatedDate DEFAULT (SYSDATETIME()),
        CONSTRAINT UQ_tOptionRevisionValidationDate_FundingYear UNIQUE (FundingYear),
        CONSTRAINT CK_tOptionRevisionValidationDate_Window CHECK (StartDate <= EndDate),
        CONSTRAINT CK_tOptionRevisionValidationDate_Year CHECK (FundingYear BETWEEN 2000 AND 2100)
    );
    PRINT 'Created dbo.tOptionRevisionValidationDate.';
END
ELSE
    PRINT 'dbo.tOptionRevisionValidationDate already exists.';
GO

/* Check: want 1 row. */
SELECT name FROM sys.tables WHERE name = N'tOptionRevisionValidationDate';
GO
