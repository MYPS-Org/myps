namespace DBHelper.Models.Enums
{
    /// <summary>The kind of a multi-year portfolio (tMultiYearPortfolio.Kind).</summary>
    public enum EnumPortfolioKind : byte
    {
        /// <summary>Regional Development Investment Program: one per region; owner = region ParticipantId.</summary>
        RDIP = 1,
        /// <summary>UPMO Development Investment Program: one per PMO cluster office; owner = that office's ParticipantId.</summary>
        UDIP = 2,
        /// <summary>Public Investment Program: one national portfolio per term; no owner.</summary>
        PIP = 3,
    }

    /// <summary>tMultiYearPortfolio.Status. A Closed term is read-only.</summary>
    public enum EnumPortfolioStatus : byte
    {
        Open = 1,
        Closed = 2,
    }

    /// <summary>A project's status inside one portfolio (tMultiYearPortfolioMember.Status), MY-PFL-11.</summary>
    public enum EnumMembershipStatus : byte
    {
        New = 1,
        Potential = 2,
        Ongoing = 3,
        Completed = 4,
        Cancelled = 5,
    }

    /// <summary>tMultiYearComponentCostPerYear.Status. Phase 1 writes Planned only; Locked and
    /// Superseded arrive with year locking (Phase 3) and Costing Changes revisions (Phase 4).</summary>
    public enum EnumCostStreamStatus : byte
    {
        Planned = 1,
        Locked = 2,
        Superseded = 3,
    }

    /// <summary>What started a run of the portfolio update (tMultiYearUpdateRun.TriggerKind), Phase 2.</summary>
    public enum EnumUpdateTrigger : byte
    {
        GaaApproved = 1,
        GaaRApproved = 2,
        GaaAdvanced = 3,
        RevisionApproved = 4,
        OnRequest = 5,
    }

    /// <summary>Why a portfolio's totals were saved (tMultiYearTotalsSnapshot.Reason), MY-PFL-24.</summary>
    public enum EnumTotalsReason : byte
    {
        TermOpened = 1,
        TermClosed = 2,
        GaaUpdate = 3,
        OnRequest = 4,
    }
}
