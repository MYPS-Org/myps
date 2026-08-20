/* =============================================================================
   Project Import — job tracking table
   -----------------------------------------------------------------------------
   Adds dbo.tImportJobResult, backing the async Hangfire import pipeline added
   in ImportingController.ImportProject / GetImportStatus and
   ImportProjectJobService.ProcessImport. The EF model
   (DBHelper/Models/Table/ImportJobResult.cs) and its DbSet on MYPSDbContext
   already existed, but no CREATE TABLE for it was ever checked in — this
   script is that missing piece. dbo.tImportingStatus (the import mutex row)
   already exists in the base schema and is untouched here.
   See documents/plans/program-import-job-dialog.md.

   Idempotent — safe to re-run.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'tImportJobResult' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.tImportJobResult (
        [Id]             INT IDENTITY(1,1) NOT NULL,
        [JobId]          NVARCHAR(50)  NOT NULL,
        [HangfireJobId]  NVARCHAR(50)  NULL,
        [Status]         NVARCHAR(50)  NOT NULL,
        [Message]        NVARCHAR(500) NULL,
        [ValidCount]     INT           NOT NULL CONSTRAINT DF_tImportJobResult_ValidCount   DEFAULT (0),
        [WarningCount]   INT           NOT NULL CONSTRAINT DF_tImportJobResult_WarningCount DEFAULT (0),
        [ErrorCount]     INT           NOT NULL CONSTRAINT DF_tImportJobResult_ErrorCount   DEFAULT (0),
        [TextFileName]   NVARCHAR(200) NULL,
        [ExcelFileName]  NVARCHAR(200) NULL,
        [QueuedAt]       DATETIME      NOT NULL,
        [StartedAt]      DATETIME      NULL,
        [CompletedAt]    DATETIME      NULL,
        [RequestedBy]    NVARCHAR(50)  NULL,
        CONSTRAINT PK_tImportJobResult PRIMARY KEY CLUSTERED ([Id] ASC)
    ) ON [PRIMARY];
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_tImportJobResult_JobId' AND object_id = OBJECT_ID('dbo.tImportJobResult'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_tImportJobResult_JobId ON dbo.tImportJobResult ([JobId] ASC);
GO
