/*
    MYPS Formal Revision request list

    Deployment order:
      1. normalized Formal Revision schema
      2. dbo.fRevisionApprovalStatus
      3. this script

    Re-synced 2026-09-03: the version of this file previously checked in here had drifted
    completely from the live database -- wrong parameter signature (@Level NVARCHAR(10) here vs.
    the live @UserId/@IsRO/@IsCO), a different status-code numbering, and different status text.
    Redeploying from the old file would have silently regressed the database. This version is
    pulled from the live definition (sp_helptext, myps_db_dev, 2026-09-03) plus the fixes below --
    it is the new source of truth going forward.

    Current business rules (confirmed live 2026-09-03, then amended per operator):
      - ROStatus/COStatus come from dbo.fRevisionApprovalStatus, which reads
        dbo.tRevisionApprovals joined to dbo.tOptionRevisionStatus.
        Status codes (tOptionRevisionStatus, confirmed live): 0=ForApproval, 1=Approved,
        2=Reject, 3=ForCorrection.
      - @UserId + @IsRO/@IsCO replace the old single @Level parameter -- a row is visible to the
        creator (rd.CreatedBy = @UserId) regardless of role, PLUS whatever the role flags add.
      - RO sees: RO-pending, CO-pending (visibility only), and fully-approved (DONE) outcomes.
      - CO sees: CO-pending, Rejected, returned-for-correction (OWNER), and fully-approved (DONE)
        outcomes. Before 2026-09-03, CO could see none of Rejected/OWNER/DONE unless they were
        also the creator -- this was a real, operator-reported visibility gap, fixed here.
      - Fully-approved (DONE) rows are now INCLUDED for RO and CO (previously excluded from the
        queue entirely under the old @Level design's business rules -- that exclusion no longer
        applies under the current live design and this fix).
      - User-facing RevisionStatus text (2026-09-03): renamed to match the UserManual's exact
        5-row badge legend (For Approval / For Correction / Disapproved / Approved / Other-Pending)
        so the frontend's fixed keyword-matching badge logic (ModifcationList.tsx:getStatusBadge,
        NOT modified by this change) resolves every state to the correct color. RO-pending and
        CO-pending deliberately collapse to the same "For Approval" text, matching the legend's
        single "For Approval" row.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.fRevisionQueue
(
    @UserId NVARCHAR(100),
    @IsRO BIT,
    @IsCO BIT
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        rd.Id,
        rd.TransactionId,
        pr.ProjectId,

        rh.RevisionName AS RevisionType,
        rr.Reason AS RevisionReason,

        q.RevisionStatus,
        q.CurrentStage,

        rd.CreatedDate AS RevisionDate,

        DATEDIFF(DAY, rd.CreatedDate, GETDATE()) AS Age

    FROM dbo.tRevisionDetails rd

    INNER JOIN dbo.tProjectRevisions pr
        ON pr.Id = rd.ProjectRevisionFK

    INNER JOIN dbo.tOptionRevisionHeader rh
        ON rh.RevisionGroupId = rd.RevisionGroupId

    INNER JOIN dbo.tOptionRevisionReasons rr
        ON rr.ReasonId = rd.ReasonId

    CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) apst

    -- ========================================================================
    -- WORKFLOW STATUS
    --
    -- Status (tOptionRevisionStatus, confirmed live 2026-09-03):
    --
    -- 0 = ForApproval
    -- 1 = Approved
    -- 2 = Reject
    -- 3 = ForCorrection
    -- ========================================================================

    CROSS APPLY
    (
        VALUES
        (
            -- =================================================================
            -- USER-FACING STATUS
            --
            -- Renamed 2026-09-03 to the UserManual's exact legend wording -- see
            -- the file header for why.
            -- =================================================================

            CASE
                -- -------------------------------------------------------------
                -- Disapproved
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 2
                  OR apst.COStatus = 2
                    THEN N'Disapproved'

                -- -------------------------------------------------------------
                -- Returned to revision owner
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 3
                  OR apst.COStatus = 3
                    THEN N'For Correction'

                -- -------------------------------------------------------------
                -- Fully approved
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 1
                    THEN N'Approved'

                -- -------------------------------------------------------------
                -- Waiting for RO
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 0
                    THEN N'For Approval'

                -- -------------------------------------------------------------
                -- RO approved; waiting for CO
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 0
                    THEN N'For Approval'

                -- -------------------------------------------------------------
                -- Unexpected state
                -- -------------------------------------------------------------

                ELSE N'Status Unavailable'
            END,

            -- =================================================================
            -- WHO CURRENTLY OWNS THE NEXT ACTION?
            -- =================================================================

            CASE
                -- -------------------------------------------------------------
                -- Terminal: rejected
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 2
                  OR apst.COStatus = 2
                    THEN N'REJECTED'

                -- -------------------------------------------------------------
                -- Correction always returns to the revision creator/owner.
                --
                -- RO returned:
                --
                --      RO = 3
                --      CO = 0
                --
                -- CO returned:
                --
                --      RO = 1
                --      CO = 3
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 3
                  OR apst.COStatus = 3
                    THEN N'OWNER'

                -- -------------------------------------------------------------
                -- Completed
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 1
                    THEN N'DONE'

                -- -------------------------------------------------------------
                -- Waiting for RO
                --
                -- Initial IO submission:
                --
                --      RO = 0
                --      CO = 0
                --
                -- Correction resubmission:
                --
                --      RO = 0
                --      CO = 0
                --
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 0
                    THEN N'RO'

                -- -------------------------------------------------------------
                -- RO approved; now CO
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 0
                    THEN N'CO'

                ELSE N'UNKNOWN'
            END
        )
    ) q
    (
        RevisionStatus,
        CurrentStage
    )

    -- ========================================================================
    -- QUEUE ACCESS
    --
    -- OWNER:
    --      Only the creator gets a correction returned to them (and, via this
    --      same branch, visibility into every other state of their own rows).
    --
    -- RO:
    --      Any authorized RO user gets RO approval work, CO approval work
    --      (visibility only), and fully-approved (DONE) outcomes -- DONE
    --      added 2026-09-03 per operator ("RO should also see the revision
    --      approved").
    --
    -- CO:
    --      Any authorized CO user gets CO approval work, plus Rejected,
    --      returned-for-correction (OWNER), and fully-approved (DONE)
    --      outcomes -- REJECTED/OWNER/DONE all added 2026-09-03 per operator
    --      ("CO user should see the rejected and forcorrection revision...
    --      RO should also see the revision approved" -- DONE extended to CO
    --      too, for symmetry with RO, per operator confirmation). Before this
    --      change CO saw only CurrentStage = 'CO' and nothing else unless
    --      they were also the creator.
    --
    --      The previous @IsRO = 2 branch here was dead code (@IsRO is BIT,
    --      can never equal 2) and has been removed.
    -- ========================================================================

    WHERE
        rd.CreatedBy = @UserId

        OR
        (
            q.CurrentStage IN (N'RO', N'CO', N'DONE')
            AND @IsRO = 1
        )

        OR
        (
            q.CurrentStage IN (N'CO', N'REJECTED', N'OWNER', N'DONE')
            AND @IsCO = 1
        )
);
GO

/*
    vRevisionPending remains an actionable-work view -- re-synced to its live definition
    2026-09-03, unmodified otherwise (out of scope for this change).

    Known pre-existing defect, confirmed live 2026-09-03, NOT fixed here (not what was asked,
    and nothing in C# currently references this view -- see repo grep, 2026-09-03 session):
    the 3 UNION branches below pass the literal strings 'IO'/'RO'/'CO' as the function's first
    parameter, but that parameter is @UserId (compared via rd.CreatedBy = @UserId), not a level
    code -- @UserId will essentially never equal 'IO'/'RO'/'CO', so that OR-branch of
    fRevisionQueue's WHERE clause silently never contributes rows through this view. The view
    still returns rows (via the @IsRO/@IsCO flags), so this degrades quietly rather than erroring.
*/
CREATE OR ALTER VIEW dbo.vRevisionPending
AS

SELECT

    q.Id                       AS RevisionDetailFK,
    rd.ProjectRevisionFK,
    rd.ProjectFK               AS ProjectPK,
    vpl.ProjectId,
    vpl.ProgramFK,
    vpl.ProgramName,
    vpl.StageName              AS CurrentProjectStage,
    vpl.Description             AS ProjectDescription,
    vpl.Region,
    vpl.ImplementingOffice,
    q.RevisionType,
    q.RevisionReason,
    q.RevisionStatus,
    q.CurrentStage              AS ApprovalOwner,
    q.RevisionDate,
    q.Age,
    rd.CreatedBy                AS SubmittedBy,
    rd.IsCertified

FROM
(
    SELECT * FROM dbo.fRevisionQueue('IO', 0, 0)
    UNION ALL SELECT * FROM dbo.fRevisionQueue('RO', 1, 0)
    UNION ALL SELECT * FROM dbo.fRevisionQueue('CO', 0, 1)
) q

JOIN dbo.tRevisionDetails rd
    ON rd.Id = q.Id

LEFT JOIN dbo.vProjectLatest vpl
    ON vpl.ProjectPK = rd.ProjectFK;
GO
