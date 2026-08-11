/*
    Read-only post-deployment verification for dbo.fRevisionQueue.
    Run after Revision.Queue.sql. Any failed invariant raises an error.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.fRevisionQueue', N'IF') IS NULL
    THROW 51000, 'dbo.fRevisionQueue was not deployed.', 1;

IF EXISTS
(
    SELECT 1
    FROM dbo.tRevisionDetails rd
    INNER JOIN dbo.tProjectRevisions pr ON pr.Id = rd.ProjectRevisionFK
    WHERE pr.ProjectFK <> rd.ProjectFK
)
    THROW 51001, 'A Formal Revision points to a baseline owned by another Project.', 1;

IF EXISTS
(
    SELECT q.Id
    FROM
    (
        SELECT * FROM dbo.fRevisionQueue(N'IO')
        UNION ALL
        SELECT * FROM dbo.fRevisionQueue(N'RO')
        UNION ALL
        SELECT * FROM dbo.fRevisionQueue(N'CO')
    ) q
    CROSS APPLY dbo.fRevisionApprovalStatus(q.Id) apst
    WHERE apst.IsFullyApproved = 1
)
    THROW 51002, 'A fully approved Revision is present in the active request list.', 1;

IF EXISTS
(
    SELECT 1
    FROM
    (
        SELECT N'IO' AS QueueLevel, * FROM dbo.fRevisionQueue(N'IO')
        UNION ALL
        SELECT N'RO', * FROM dbo.fRevisionQueue(N'RO')
        UNION ALL
        SELECT N'CO', * FROM dbo.fRevisionQueue(N'CO')
    ) q
    WHERE q.Id IS NULL
       OR q.TransactionId IS NULL
       OR q.ProjectFK IS NULL
       OR q.ProjectId IS NULL
       OR q.StatusCode IS NULL
       OR q.RevisionStatus IS NULL
)
    THROW 51003, 'The queue returned a row with a missing required value.', 1;

IF EXISTS
(
    SELECT QueueLevel, Id
    FROM
    (
        SELECT N'IO' AS QueueLevel, Id FROM dbo.fRevisionQueue(N'IO')
        UNION ALL
        SELECT N'RO', Id FROM dbo.fRevisionQueue(N'RO')
        UNION ALL
        SELECT N'CO', Id FROM dbo.fRevisionQueue(N'CO')
    ) q
    GROUP BY QueueLevel, Id
    HAVING COUNT(*) > 1
)
    THROW 51004, 'The same Revision appears more than once in one actor queue.', 1;

IF EXISTS
(
    SELECT 1
    FROM
    (
        SELECT * FROM dbo.fRevisionQueue(N'IO')
        UNION ALL
        SELECT * FROM dbo.fRevisionQueue(N'RO')
        UNION ALL
        SELECT * FROM dbo.fRevisionQueue(N'CO')
    ) q
    WHERE (q.StatusCode IN (N'RO_DISAPPROVED', N'CO_DISAPPROVED') AND (q.IsTerminal = 0 OR q.IsActionable = 1))
       OR (q.StatusCode NOT IN (N'RO_DISAPPROVED', N'CO_DISAPPROVED') AND (q.IsTerminal = 1 OR q.IsActionable = 0))
)
    THROW 51005, 'Terminal/actionable flags do not match the queue status.', 1;

SELECT
    QueueLevel,
    StatusCode,
    COUNT_BIG(*) AS RowCount
FROM
(
    SELECT N'IO' AS QueueLevel, StatusCode FROM dbo.fRevisionQueue(N'IO')
    UNION ALL
    SELECT N'RO', StatusCode FROM dbo.fRevisionQueue(N'RO')
    UNION ALL
    SELECT N'CO', StatusCode FROM dbo.fRevisionQueue(N'CO')
) q
GROUP BY QueueLevel, StatusCode
ORDER BY QueueLevel, StatusCode;

PRINT 'Revision queue verification passed.';
