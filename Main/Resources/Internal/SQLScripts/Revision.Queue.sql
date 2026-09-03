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
        badge legend (For Approval / For Correction / Disapproved / Approved / Other-Pending) so
        the frontend's fixed keyword-matching badge logic (ModifcationList.tsx:getStatusBadge,
        NOT modified by this change) resolves every state to the correct color.
      - Same-day correction (2026-09-03, later pass): RO-pending and CO-pending were initially
        collapsed to the identical "For Approval" text, which made the RO->CO hand-off invisible
        (the underlying CASE already picked the right status, but both branches rendered
        identically). CO-pending now reads "For Approval of Central Office" -- still contains the
        substring "for approval", so the frontend's yellow-badge keyword match still fires for
        both -- while RO-pending stays plain "For Approval".
      - Program columns (2026-09-03, same pass): ProgramName/ProgramId/ProgramFK added via a
        LEFT JOIN to vProjectLatest (tRevisionDetails.ProjectFK -> vProjectLatest.ProjectPK), the
        established convention this codebase already uses everywhere for "get Program info for a
        Project" -- backs a new ProgramName filter on the RevisionRequests list endpoint.
      - CurrentStage relabeled to real group identity (2026-09-03, 3rd pass): 'RO' -> 'RPC'
        (RPC is tGroups.GroupName = "Regional Planning Coordinator", the actual group this
        codebase already checks membership against in RevisionController.cs/RevisionHelper.cs --
        confirmed live, tGroups has no row for "AUC"'s generic abbreviation either). 'CO' ->
        'PS Admin' -- confirmed via live tGroups query that no "PS Admin" row exists (AUC's real
        description is "Application User Coordinator"); "PS Admin" is a hardcoded label chosen to
        match the UserManual's own established human-facing convention (60+ occurrences,
        including its glossary), not a group name pulled from data. CurrentStage is confirmed
        (2026-09-03 session, 2 Explore agents) to never be displayed anywhere in the frontend --
        only consumed by this function's own WHERE clause and an unused inbound filter -- so this
        rename carries no frontend display risk. The WHERE clause literals below changed in
        lockstep; visibility logic itself is unchanged, only the labels.
      - RevisionStatus 'For Endorsement' for ROStatus=0 (2026-09-03, 3rd pass, operator-directed):
        matches this system's own established terminology -- the frontend already labels RPC's
        action "Endorse" (not "Approve") elsewhere, since RPC only forwards to PS Admin/CO for the
        real approval (revisionActions.ts). KNOWN, ACCEPTED SIDE EFFECT: the frontend's fixed
        badge-color keyword list (ModifcationList.tsx:getStatusBadge, NOT modified) has no match
        for "endorsement" -- this state now renders gray ("Other/Pending") instead of yellow. This
        was confirmed and explicitly accepted by the operator rather than compromising the wording
        to preserve the yellow badge, since touching the frontend keyword list was ruled out.
      - CurrentStage redesigned to ALWAYS resolve to a real group (2026-09-03, 4th pass,
        operator-directed): CurrentStage previously still fell back to the status words REJECTED/
        OWNER/DONE for those 3 states -- the operator confirmed (3x) it should instead show WHICH
        group -- RPC or PS Admin -- for every branch, with no 3rd "OWNER"-style value, since no
        group-membership check for a submitter role exists anywhere in this workflow (confirmed by
        grep -- only RPC/AUC are ever checked; "DEO" is a project field, not a group). Mapping:
        RPC rejected (ROStatus=2) -> RPC; PS Admin rejected (COStatus=2) -> PS Admin; RPC returned
        for correction (ROStatus=3) -> RPC; PS Admin returned for correction (COStatus=3) -> PS
        Admin; fully approved/DONE (ROStatus=1,COStatus=1) -> PS Admin (the group whose action
        finalized it); RPC-pending/PS-Admin-pending unchanged from Pass 3.
        CRITICAL DEPENDENCY HANDLED: the WHERE clause below used to key visibility directly off
        CurrentStage's string value (IN ('RPC','PS Admin','DONE') etc, Pass 3's design) -- collapsing
        CurrentStage to just 2 possible values would have made REJECTED/OWNER/DONE indistinguishable
        from the pending states and silently broken the visibility fix from Pass 1. Fixed by
        introducing a 3rd, INTERNAL-ONLY value in the same CROSS APPLY, StageBucket (REJECTED/OWNER/
        DONE/RPC_PENDING/PSADMIN_PENDING/UNKNOWN) -- exactly Pass 3's own classification under
        renamed literals, not exposed in the outer SELECT, used purely by the WHERE clause. This
        keeps visibility semantics byte-for-byte identical to Pass 3 while freeing CurrentStage to
        be a pure, always-a-group display value. Proven via a rollback-only drill confirming both
        the new CurrentStage values AND unchanged RO/CO visibility counts before deploying.
      - CurrentStage for "For Correction" (OWNER bucket) resolves to the REQUESTOR's real group,
        not a reviewer's (2026-09-03, same 4th pass, operator refinement): "For Correction" means
        the next action belongs to whoever created the revision, not to RPC or PS Admin (they
        already acted -- that's WHY it bounced back). Resolved dynamically via
        dbo.tUserGroups.GroupIds (a JSON array of Group IDs per UserId, confirmed live schema) ->
        dbo.tGroups.GroupName, matched against tRevisionDetails.CreatedBy -- e.g. confirmed live,
        'caldokp' (creator of 3 real test revisions) resolves to GroupIds='[4]' -> tGroups.Id=4 ->
        GroupName='DPC'. This is the SAME real lookup mechanism 'RPC'/'PS Admin' themselves,
        confirmed to exist and now reused generally rather than assuming only 2 groups are ever
        relevant. If a creator belongs to multiple groups, TOP 1 ordered by tGroups.Id is used
        (deterministic, but an arbitrary tie-break -- flagged, not resolved against real
        multi-group data, since no creator in the current dataset has more than one group). If the
        creator has no resolvable group at all, falls back to 'UNKNOWN'. REJECTED and DONE stay
        reviewer-based (who rejected / who approved as CO) -- operator explicitly confirmed this
        after a clarifying round ("Reject and done should be whoever did the action like who
        rejects, or approved by co"), not an assumption.
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

        DATEDIFF(DAY, rd.CreatedDate, GETDATE()) AS Age,

        vpl.ProgramName,
        vpl.ProgramId,
        vpl.ProgramFK

    FROM dbo.tRevisionDetails rd

    INNER JOIN dbo.tProjectRevisions pr
        ON pr.Id = rd.ProjectRevisionFK

    INNER JOIN dbo.tOptionRevisionHeader rh
        ON rh.RevisionGroupId = rd.RevisionGroupId

    INNER JOIN dbo.tOptionRevisionReasons rr
        ON rr.ReasonId = rd.ReasonId

    LEFT JOIN dbo.vProjectLatest vpl
        ON vpl.ProjectPK = rd.ProjectFK

    CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) apst

    -- ========================================================================
    -- REQUESTOR'S REAL GROUP -- used only by the "For Correction" branch of
    -- CurrentStage below. dbo.tUserGroups.GroupIds is a JSON array of Group
    -- IDs per UserId; TOP 1 ordered by Id if a user has more than one group
    -- (arbitrary tie-break, not exercised by any real creator in current
    -- data -- see file header, Pass 4 refinement).
    -- ========================================================================

    OUTER APPLY
    (
        SELECT TOP 1 g.GroupName
        FROM dbo.tUserGroups ug
        CROSS APPLY OPENJSON(ug.GroupIds) WITH (GroupId INT '$') gid
        INNER JOIN dbo.tGroups g
            ON g.Id = gid.GroupId
        WHERE ug.UserId = rd.CreatedBy
        ORDER BY g.Id
    ) creatorGroup

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
                -- Waiting for RO (RPC) -- "Endorsement", not "Approval": RPC only
                -- forwards to PS Admin/CO for the real approval (matches this
                -- system's own established terminology, see file header).
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 0
                    THEN N'For Endorsement'

                -- -------------------------------------------------------------
                -- RO approved; waiting for CO
                --
                -- Distinct text from RO-pending (2026-09-03 correction) -- both
                -- contain "for approval" so the frontend's yellow-badge keyword
                -- match still fires for either, but the RO->CO hand-off is now
                -- observable instead of rendering identically to RO-pending.
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 0
                    THEN N'For Approval of Central Office'

                -- -------------------------------------------------------------
                -- Unexpected state
                -- -------------------------------------------------------------

                ELSE N'Status Unavailable'
            END,

            -- =================================================================
            -- STAGE BUCKET -- internal only, NOT selected in the outer SELECT.
            -- Drives the WHERE clause's visibility routing. Identical
            -- classification to CurrentStage pre-Pass-4, under renamed
            -- literals so they can't collide with CurrentStage's new
            -- always-a-group values below. See file header, Pass 4.
            -- =================================================================

            CASE
                WHEN apst.ROStatus = 2
                  OR apst.COStatus = 2
                    THEN N'REJECTED'

                WHEN apst.ROStatus = 3
                  OR apst.COStatus = 3
                    THEN N'OWNER'

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 1
                    THEN N'DONE'

                WHEN apst.ROStatus = 0
                    THEN N'RPC_PENDING'

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 0
                    THEN N'PSADMIN_PENDING'

                ELSE N'UNKNOWN'
            END,

            -- =================================================================
            -- CURRENT STAGE -- always resolves to a real group (RPC or PS
            -- Admin), never a status word. See file header, Pass 4, for why
            -- REJECTED/OWNER/DONE became group-based and how visibility
            -- routing was preserved via StageBucket above.
            -- =================================================================

            CASE
                -- -------------------------------------------------------------
                -- Rejected -- shows WHICH group rejected it.
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 2
                    THEN N'RPC'

                WHEN apst.COStatus = 2
                    THEN N'PS Admin'

                -- -------------------------------------------------------------
                -- Returned for correction -- shows the REQUESTOR's real group
                -- (not a reviewer's -- see file header, Pass 4 refinement).
                -- Whichever office sent it back, the next action belongs to
                -- whoever created the revision, so both branches resolve the
                -- same way via creatorGroup (dbo.tUserGroups/dbo.tGroups).
                --
                -- RO returned:  RO = 3, CO = 0
                -- CO returned:  RO = 1, CO = 3
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 3
                  OR apst.COStatus = 3
                    THEN ISNULL(creatorGroup.GroupName, N'UNKNOWN')

                -- -------------------------------------------------------------
                -- Fully approved -- PS Admin's action is what finalized it
                -- (CO always acts last in the sequential RO-then-CO model).
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 1
                    THEN N'PS Admin'

                -- -------------------------------------------------------------
                -- Waiting for RO -- displayed as the real group name, RPC
                -- (Regional Planning Coordinator, confirmed live tGroups row),
                -- not the abstract "RO" abbreviation. See file header.
                --
                -- Initial IO submission:      RO = 0, CO = 0
                -- Correction resubmission:    RO = 0, CO = 0
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 0
                    THEN N'RPC'

                -- -------------------------------------------------------------
                -- RO approved; now CO -- displayed as "PS Admin", the
                -- UserManual's established human-facing label for this role
                -- (no "PS Admin" row exists in tGroups; AUC is the real group,
                -- described as "Application User Coordinator"). See file header.
                -- -------------------------------------------------------------

                WHEN apst.ROStatus = 1
                 AND apst.COStatus = 0
                    THEN N'PS Admin'

                ELSE N'UNKNOWN'
            END
        )
    ) q
    (
        RevisionStatus,
        StageBucket,
        CurrentStage
    )

    -- ========================================================================
    -- QUEUE ACCESS
    --
    -- @IsRO/@IsCO are role FLAGS (unchanged param names -- they mean "is this
    -- user in the RPC group" / "is this user in the AUC group" respectively).
    -- Visibility routes off StageBucket (internal-only, Pass 4), NOT
    -- CurrentStage -- CurrentStage is now a pure, always-a-group display
    -- value and can no longer distinguish REJECTED/OWNER/DONE from the
    -- pending states (see file header, Pass 4, "CRITICAL DEPENDENCY HANDLED").
    --
    -- OWNER:
    --      Only the creator gets a correction returned to them (and, via this
    --      same branch, visibility into every other state of their own rows).
    --
    -- RO (RPC):
    --      Any authorized RPC user gets RPC's own approval work, PS Admin's
    --      approval work (visibility only), and fully-approved (DONE)
    --      outcomes -- DONE added 2026-09-03 per operator ("RO should also
    --      see the revision approved").
    --
    -- CO (PS Admin):
    --      Any authorized AUC user gets PS Admin's own approval work, plus
    --      Rejected, returned-for-correction (OWNER), and fully-approved
    --      (DONE) outcomes -- REJECTED/OWNER/DONE all added 2026-09-03 per
    --      operator ("CO user should see the rejected and forcorrection
    --      revision... RO should also see the revision approved" -- DONE
    --      extended to CO too, for symmetry with RO, per operator
    --      confirmation). Before that change CO saw only StageBucket =
    --      'PSADMIN_PENDING' and nothing else unless they were also the
    --      creator.
    --
    --      The previous @IsRO = 2 branch here was dead code (@IsRO is BIT,
    --      can never equal 2) and has been removed.
    -- ========================================================================

    WHERE
        rd.CreatedBy = @UserId

        OR
        (
            q.StageBucket IN (N'RPC_PENDING', N'PSADMIN_PENDING', N'DONE')
            AND @IsRO = 1
        )

        OR
        (
            q.StageBucket IN (N'PSADMIN_PENDING', N'REJECTED', N'OWNER', N'DONE')
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
