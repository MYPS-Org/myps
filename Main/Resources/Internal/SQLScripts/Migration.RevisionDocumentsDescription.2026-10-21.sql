/* =============================================================================
   Migration — add dbo.tOptionRevisionDocuments.Description
   Date: 2026-10-21 · UAT S04-TC012-P001 remark: "Add a Description column"
   -----------------------------------------------------------------------------
   Code Tables → Revision → Documents lists each document's second segment (the
   middle part of an uploaded file's name, e.g. "A" in
   P01100041LZ-1_A_08-25-2026.pdf), but nothing said what a segment stands for.
   This adds a free-text Description, editable on that screen.

   RUN THIS BEFORE DEPLOYING THE API THAT CARRIES OptionRevisionDocuments.Description.
   EF selects every mapped column, so until the column exists every read of
   tOptionRevisionDocuments fails ("Invalid column name 'Description'"): the Code
   Tables page AND revision submission (RevisionController names the uploaded
   documents from this table).

   Nullable, no default, no backfill: existing rows read as blank until someone
   describes them. Idempotent: re-running changes nothing. Run by hand per
   environment, like the other Migration.* scripts.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'dbo.tOptionRevisionDocuments', N'Description') IS NULL
BEGIN
    ALTER TABLE dbo.tOptionRevisionDocuments ADD Description nvarchar(500) NULL;
    PRINT 'Added dbo.tOptionRevisionDocuments.Description.';
END
ELSE
    PRINT 'dbo.tOptionRevisionDocuments.Description already exists; nothing to do.';
GO
