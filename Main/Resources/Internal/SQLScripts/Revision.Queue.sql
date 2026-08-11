/*
    MYPS Formal Revision request list

    Deployment order:
      1. normalized Formal Revision schema
      2. dbo.fRevisionApprovalStatus
      3. this script

    Business decisions captured 2026-08-11:
      - no Draft queue state;
      - IO document is required atomically before RO submission;
      - RO approval moves directly to CO pending;
      - fully approved rows are excluded;
      - RO-disapproved is visible to scoped IO and RO users;
      - CO-disapproved is visible to scoped IO, RO, and CO users;
      - Disapproved rows are terminal and nonactionable.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.fRevisionQueue
(
    @Level NVARCHAR(10)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        rd.Id AS Id,
        rd.TransactionId,
        rd.ProjectFK,
        rd.ProjectRevisionFK,
        pr.ProjectId,
        rd.RevisionGroupId,
        rh.RevisionName AS RevisionType,
        rd.CategoryId,
        rc.CategoryName,
        rd.ReasonId,
        rr.Reason AS RevisionReason,
        CASE
            WHEN apst.ROStatus = 5 THEN N'RO_DISAPPROVED'
            WHEN apst.COStatus = 5 THEN N'CO_DISAPPROVED'
            WHEN @Level = N'IO' AND apst.ROStatus = 3 THEN N'RO_FOR_CORRECTION'
            WHEN @Level = N'IO' AND apst.ROStatus = 4 AND apst.COStatus = 3 THEN N'CO_FOR_CORRECTION'
            WHEN @Level = N'RO' AND apst.ROStatus = 1 THEN N'RO_PENDING'
            WHEN @Level = N'CO' AND apst.ROStatus = 4 AND apst.COStatus = 0 THEN N'CO_PENDING'
        END AS StatusCode,
        CASE
            WHEN apst.ROStatus = 5 THEN N'Disapproved by RO'
            WHEN apst.COStatus = 5 THEN N'Disapproved by CO'
            WHEN @Level = N'IO' AND apst.ROStatus = 3 THEN N'Returned by RO'
            WHEN @Level = N'IO' AND apst.ROStatus = 4 AND apst.COStatus = 3 THEN N'Returned by CO'
            WHEN @Level = N'RO' AND apst.ROStatus = 1 THEN N'Submitted for RO Review'
            WHEN @Level = N'CO' AND apst.ROStatus = 4 AND apst.COStatus = 0 THEN N'Pending CO Review'
        END AS RevisionStatus,
        CASE
            WHEN apst.IsDisapproved = 1 THEN NULL
            WHEN @Level = N'IO' THEN N'IO'
            WHEN @Level = N'RO' THEN N'RO'
            WHEN @Level = N'CO' THEN N'CO'
        END AS ApprovalOwner,
        CAST(CASE WHEN apst.IsDisapproved = 1 THEN 1 ELSE 0 END AS BIT) AS IsTerminal,
        CAST(CASE WHEN apst.IsDisapproved = 1 THEN 0 ELSE 1 END AS BIT) AS IsActionable,
        pr.Region,
        pr.ImplementingOffice,
        rd.CreatedDate AS RevisionDate,
        DATEDIFF(DAY, rd.CreatedDate, GETDATE()) AS AgeDays
    FROM dbo.tRevisionDetails rd
    INNER JOIN dbo.tProjectRevisions pr
        ON pr.Id = rd.ProjectRevisionFK
       AND pr.ProjectFK = rd.ProjectFK
    INNER JOIN dbo.tOptionRevisionHeader rh
        ON rh.RevisionGroupId = rd.RevisionGroupId
    INNER JOIN dbo.tOptionRevisionReasons rr
        ON rr.ReasonId = rd.ReasonId
       AND rr.RevisionGroupId = rd.RevisionGroupId
    LEFT JOIN dbo.tOptionRevisionCategory rc
        ON rc.CategoryId = rd.CategoryId
       AND rc.RevisionGroupId = rd.RevisionGroupId
    CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) apst
    WHERE
        apst.IsFullyApproved = 0
        AND
        (
            (@Level = N'IO' AND
                (
                    apst.ROStatus = 3
                    OR (apst.ROStatus = 4 AND apst.COStatus = 3)
                ))
            OR (@Level = N'RO' AND apst.ROStatus = 1)
            OR (@Level = N'CO' AND apst.ROStatus = 4 AND apst.COStatus = 0)
            OR (@Level IN (N'IO', N'RO') AND apst.ROStatus = 5)
            OR (@Level IN (N'IO', N'RO', N'CO') AND apst.COStatus = 5)
        )
);
GO

/*
    vRevisionPending remains an actionable-work view. Disapproved rows are
    available through fRevisionQueue for compatibility with RevisionRequests,
    but are deliberately excluded from this pending-only view.
*/
CREATE OR ALTER VIEW dbo.vRevisionPending
AS
SELECT
    q.Id AS RevisionDetailFK,
    q.ProjectRevisionFK,
    q.ProjectFK AS ProjectPK,
    q.ProjectId,
    vpl.ProgramFK,
    vpl.ProgramName,
    vpl.StageName AS CurrentProjectStage,
    vpl.Description AS ProjectDescription,
    q.Region,
    q.ImplementingOffice,
    q.RevisionGroupId,
    q.RevisionType,
    q.CategoryId,
    q.CategoryName,
    q.ReasonId,
    q.RevisionReason,
    q.StatusCode,
    q.RevisionStatus,
    q.ApprovalOwner,
    q.RevisionDate,
    q.AgeDays,
    rd.CreatedBy AS SubmittedBy,
    rd.IsCertified
FROM
(
    SELECT * FROM dbo.fRevisionQueue(N'IO')
    UNION ALL
    SELECT * FROM dbo.fRevisionQueue(N'RO')
    UNION ALL
    SELECT * FROM dbo.fRevisionQueue(N'CO')
) q
INNER JOIN dbo.tRevisionDetails rd
    ON rd.Id = q.Id
LEFT JOIN dbo.vProjectLatest vpl
    ON vpl.ProjectPK = q.ProjectFK
WHERE q.IsActionable = 1;
GO
