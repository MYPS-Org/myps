/* =============================================================================
   Lump Sum — READ_COMMITTED_SNAPSHOT for the MYPS database
   -----------------------------------------------------------------------------
   Deliberately NOT part of LumpSum.Baseline.sql: the Baseline creates the
   module's objects and is safe to run against any copy of the database at any
   time. This script changes how the WHOLE database isolates readers from
   writers, which is a decision about the server, taken once, and in production
   by the DBA. Run it on its own, and read the header first.

   WHAT IT DOES
     ALTER DATABASE <current> SET READ_COMMITTED_SNAPSHOT ON

   Under plain READ COMMITTED every SELECT takes shared locks as it reads and
   waits behind any exclusive lock it meets. With READ_COMMITTED_SNAPSHOT on,
   a SELECT reads the last COMMITTED version of each row from the version store
   in tempdb instead, so readers never block writers, writers never block
   readers, and a reader can no longer be one half of a deadlock with a writer.
   Writers still lock one another exactly as before, and every lock hint in the
   code base (UPDLOCK, HOLDLOCK on the project-id allocator; XLOCK in the Lump
   Sum hard deletes) still forces its lock — hints override the default.

   WHY (documents/docs/engineering/MYPS_LUMPSUM_DEADLOCK_RCA.md, 2026-09-06)
   The Lump Sum detail read deadlocked, repeatedly and across the whole day,
   with the hard delete of a DIFFERENT project: the read held a shared key lock
   on a revision row while waiting for a page of stages the delete held, and the
   delete waited to convert its lock on that revision. SQL Server killed the
   read (error 1205) every time. The view was also rewritten to seek instead of
   scan, and the deletes now lock their rows in the reader's order — those two
   close the observed cycle. This setting closes the CLASS: the same shape is
   waiting in every module that reads through a view while something else
   writes (e2e/CLAUDE.md already pins its workers to 1 for a deadlock on
   UpdateProjectDetails).

   WHAT IT COSTS
     - Every UPDATE/DELETE writes the previous row version to tempdb's version
       store, kept until no transaction can still need it. Long-running
       transactions therefore grow tempdb. Watch:
           SELECT * FROM sys.dm_tran_version_store_space_usage;
       On this database the longest transaction is the itemization import,
       which spans one workbook's validation — seconds.
     - The ALTER needs the database to itself for an instant. WITH ROLLBACK
       IMMEDIATE below rolls back every open transaction and DISCONNECTS every
       other session to get it. Run it when the application is idle; pooled
       connections (the API, Hangfire) reconnect on their next use.

   WHAT IT DOES NOT CHANGE
     - Nothing in this repository relies on a read BLOCKING: there is no
       TransactionScope, no IsolationLevel.*, no NOLOCK, and the one
       check-then-act that must be serialised (tProjectIdSequence) already
       holds UPDLOCK/HOLDLOCK. Writers of the same Lump Sum parent are kept
       apart by sp_getapplock, released at commit, so a read taken after the
       lock sees the previous writer's commit.
     - ALLOW_SNAPSHOT_ISOLATION is left OFF. That is the opt-in, per-transaction
       SNAPSHOT level; nothing here asks for it.

   PRODUCTION
     This is a DBA change on a database shared with the legacy IIS application.
     Apply in a maintenance window, with the same statement, and confirm with
     the SELECT at the end. It is one flag; reverting is the same statement
     with OFF.

   Idempotent — a second run prints the state and changes nothing.
   ============================================================================= */

SET NOCOUNT ON;
GO

PRINT '--- before ---';
SELECT name AS [database],
       is_read_committed_snapshot_on   AS read_committed_snapshot,
       snapshot_isolation_state_desc   AS allow_snapshot_isolation
FROM   sys.databases
WHERE  database_id = DB_ID();
GO

IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()) = 0
BEGIN
    DECLARE @db sysname = DB_NAME();
    DECLARE @sql nvarchar(400) =
        N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;';
    PRINT @sql;
    EXEC sp_executesql @sql;
    PRINT CONCAT('READ_COMMITTED_SNAPSHOT turned ON for ', @db, '.');
END
ELSE
    PRINT 'READ_COMMITTED_SNAPSHOT is already ON; nothing to do.';
GO

PRINT '--- after ---';
SELECT name AS [database],
       is_read_committed_snapshot_on   AS read_committed_snapshot,
       snapshot_isolation_state_desc   AS allow_snapshot_isolation
FROM   sys.databases
WHERE  database_id = DB_ID();
GO

PRINT 'LumpSum.Isolation.ReadCommittedSnapshot.sql complete.';
GO
