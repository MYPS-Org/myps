-- ============================================================================
-- ProjectThrustCategory.Verification.sql
--
-- Read-only diagnostic/report queries used during the 2026-09-10 Project
-- Thrust/Category investigation (dropdown display bug, save-time validation,
-- the IsCurrentlyValid redesign, and the 556 Category/Thrust mismatch RCA).
-- None of these mutate data -- saved here so the audit trail is reproducible
-- instead of living only in ad-hoc PowerShell/sqlcmd command history.
--
-- Companion docs:
--   documents/docs/engineering/MYPS_PROJECT_THRUST_CATEGORY_VALIDATION_RCA_AND_DECISION.md
--   documents/docs/engineering/MYPS_UNMAPPED_ACTIVE_THRUST_PAPKEYS_1062_1065_1140.md
--   Obsidian vault: 17 - Risks & Technical Debt/Risk Register.md (2026-09-10 entries)
--
-- Target at time of writing: myps_db_dev on 192.168.50.200 (per CLAUDE.md SKL-005/047 --
-- re-confirm the current approved target before re-running against a different host).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Full live tOptionProjectCategoryToPAPMap dump (CategoryId|PAPKey), used to
--    diff against the authoritative category_to_pap_many2many_map.xlsx source
--    file and confirm the live mapping table matches it exactly.
-- ----------------------------------------------------------------------------
SELECT CategoryId, PAPKey
FROM tOptionProjectCategoryToPAPMap
ORDER BY CategoryId, PAPKey;


-- ----------------------------------------------------------------------------
-- 2. Does PAPKey 1157 exist in tOptionProjectThrustList at all (even inactive)?
--    Central to the 556-mismatch investigation: 1157 is real, active, but
--    ValidToDate=2023 (expired) and unmapped anywhere in the source file.
-- ----------------------------------------------------------------------------
SELECT PAPKey, ThrustDescription, IsActive
FROM tOptionProjectThrustList
WHERE PAPKey = 1157;


-- ----------------------------------------------------------------------------
-- 3. Inactive Thrust rows (IsActive = 0) -- these were excluded by the OLD
--    ShowProjectDropdowns filter (removed 2026-09-10). At the time this was
--    run, zero rows matched (every live Thrust row is IsActive=1) -- the
--    dropdown-permissiveness fix is preventive, not fixing a live incident.
-- ----------------------------------------------------------------------------
DECLARE @Year INT = YEAR(GETDATE());

SELECT PAPKey, ThrustDescription, IsActive, ValidToDate,
    CASE WHEN IsActive = 1 OR (ValidToDate = 0 OR ValidToDate >= @Year) THEN 1 ELSE 0 END AS PassesSaveTimeValidation
FROM tOptionProjectThrustList
WHERE IsActive = 0;

-- Live projects (latest revision only) currently holding one of those inactive
-- Thrust values -- cross-check for any active incident.
SELECT pr.ProjectFK, pr.Id AS RevisionId, pr.Thrust, t.ThrustDescription, t.IsActive, t.ValidToDate
FROM tProjectRevisions pr
JOIN tOptionProjectThrustList t ON t.PAPKey = pr.Thrust
WHERE t.IsActive = 0
  AND pr.Id = (SELECT MAX(pr2.Id) FROM tProjectRevisions pr2 WHERE pr2.ProjectFK = pr.ProjectFK);


-- ----------------------------------------------------------------------------
-- 4. The 3 unmapped-but-non-expired PAPKeys (1062, 1065, 1140) -- documented
--    in MYPS_UNMAPPED_ACTIVE_THRUST_PAPKEYS_1062_1065_1140.md. Includes the
--    1058 comparison row (possible near-duplicate of 1140) and live usage
--    counts for all three.
-- ----------------------------------------------------------------------------
SELECT PAPKey, ProgramName, SubProgramName, ActivityName, SequenceNumber,
       ValidFromDate, ValidToDate, InfrastructureType, ThrustDescription, IsActive
FROM tOptionProjectThrustList
WHERE PAPKey IN (1062, 1065, 1140)
ORDER BY PAPKey;

-- Comparison: PAPKey 1058, the already-mapped row 1140 may be a duplicate of.
SELECT PAPKey, ProgramName, SubProgramName, ThrustDescription, ValidFromDate, ValidToDate, IsActive
FROM tOptionProjectThrustList WHERE PAPKey = 1058;

-- Live usage counts (latest revision only) for each of the 3 PAPKeys.
SELECT
    (SELECT COUNT(*) FROM tProjectRevisions pr WHERE pr.Thrust = 1062 AND pr.Id = (SELECT MAX(pr2.Id) FROM tProjectRevisions pr2 WHERE pr2.ProjectFK = pr.ProjectFK)) AS ProjectsUsing1062,
    (SELECT COUNT(*) FROM tProjectRevisions pr WHERE pr.Thrust = 1065 AND pr.Id = (SELECT MAX(pr2.Id) FROM tProjectRevisions pr2 WHERE pr2.ProjectFK = pr.ProjectFK)) AS ProjectsUsing1065,
    (SELECT COUNT(*) FROM tProjectRevisions pr WHERE pr.Thrust = 1140 AND pr.Id = (SELECT MAX(pr2.Id) FROM tProjectRevisions pr2 WHERE pr2.ProjectFK = pr.ProjectFK)) AS ProjectsUsing1140;


-- ----------------------------------------------------------------------------
-- 5. IsCurrentlyValid boundary-verification -- hand-check the computed
--    [NotMapped] property's logic (OptionProjectCategory.cs / OptionProjectThrustList.cs)
--    against real rows near the current-year boundary. Re-run and eyeball
--    "Expected" vs. what the app actually renders if this logic is ever
--    touched again.
-- ----------------------------------------------------------------------------
SELECT CategoryId, CategoryName, ValidUntil,
    CASE WHEN ValidUntil = 0 OR ValidUntil >= YEAR(GETDATE()) THEN 1 ELSE 0 END AS ExpectedIsCurrentlyValid
FROM tOptionProjectCategory
WHERE ValidUntil BETWEEN YEAR(GETDATE()) - 2 AND YEAR(GETDATE()) + 1 OR ValidUntil = 0
ORDER BY ValidUntil;

SELECT TOP 10 PAPKey, ThrustDescription, ValidToDate,
    CASE WHEN ValidToDate = 0 OR ValidToDate >= YEAR(GETDATE()) THEN 1 ELSE 0 END AS ExpectedIsCurrentlyValid
FROM tOptionProjectThrustList
WHERE ValidToDate BETWEEN YEAR(GETDATE()) - 2 AND YEAR(GETDATE()) + 1
ORDER BY ValidToDate;


-- ----------------------------------------------------------------------------
-- 6. Data-integrity sanity check for the IsCurrentlyValid computed property --
--    confirms ValidUntil/ValidToDate/CategoryId/PAPKey never go negative or
--    zero-as-a-real-ID in live data (the invariant filterKeepingSelected's
--    frontend "0 = no selection" handling silently relies on).
-- ----------------------------------------------------------------------------
SELECT MIN(ValidUntil) AS MinVal, MAX(ValidUntil) AS MaxVal,
       SUM(CASE WHEN ValidUntil < 0 THEN 1 ELSE 0 END) AS NegativeCount, COUNT(*) AS TotalRows
FROM tOptionProjectCategory;

SELECT MIN(ValidToDate) AS MinVal, MAX(ValidToDate) AS MaxVal,
       SUM(CASE WHEN ValidToDate < 0 THEN 1 ELSE 0 END) AS NegativeCount, COUNT(*) AS TotalRows
FROM tOptionProjectThrustList;

SELECT MIN(CategoryId) AS MinCategoryId, SUM(CASE WHEN CategoryId <= 0 THEN 1 ELSE 0 END) AS ZeroOrNegativeCount
FROM tOptionProjectCategory;

SELECT MIN(PAPKey) AS MinPAPKey, SUM(CASE WHEN PAPKey <= 0 THEN 1 ELSE 0 END) AS ZeroOrNegativeCount
FROM tOptionProjectThrustList;
