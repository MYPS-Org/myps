"""READ-ONLY check that the itemization history landed, and that its links resolve.

WHY

The old model records an itemization as a dbo.history row against the CHILD, in the GAA-R
program only: "Itemized from Project: <parent>". alternate_id does not carry it. The loader
copies those rows into tProjectNotes so the Lump Sum SQL migration can read the parent/child
link from the target rather than from a second database.

Three checks, all SELECT only:

  1. COUNT — notes on the target vs itemization notes in the source, per program. Must match.
  2. LINKS — for each "Itemized from Project: X" note, does X resolve to a project on the
     target, and does the noted child have a live revision? Unresolved links are listed;
     one is known (P00851066VS in GAA 2024 SSP has a note but no source project row).
  3. DUPLICATES — the same (revision, text, date) written more than once, which would mean
     the loader's NOT EXISTS guard failed and a back-fill double-ran.

Usage (repo root, pixi env python):
    python -m app.data_migration.test_sql.verify_itemization_notes --program-id P_CO-PS-535_03292023_105429
    python -m app.data_migration.test_sql.verify_itemization_notes --all

Exit code 1 if a count disagrees or a duplicate exists. Unresolved links are reported but do
not fail the run — they are data, not a loader defect.
"""
import argparse
import sys

import pandas as pd
import sqlalchemy as sqa

SOURCE_DB_NAME = "MYPS_BAK"
TARGET_DB_NAME = "myps_db_dev_200"
DB_HOSTNAME = "localhost"
DB_USERNAME = "sa"
DB_PASSWORD = ***REMOVED***

# Every GAA-R program that carries itemization notes for the migrated years. Notes only ever
# exist at GAA-R: that is the stage at which itemization happens.
ALL_PROGRAM_IDS = [
    "P_CO-PS-535_03292023_105429",  # GAA 2023 CSSP
    "P_CO-PS-535_03272023_132031",  # GAA 2023 LP
    "P_CO-PS-635_04182023_172516",  # GAA 2023 OO-1
    "P_CO-PS-535_03252024_154915",  # GAA 2024 SSP
    "P_CO-PS-634_03252024_123925",  # GAA 2024 OO-1
    "P_CO-PS-220_03252024_155224",  # GAA 2024 LP
    "P_CO-PS-635_04112025_134220",  # GAA 2025 OO-1 (none expected)
]

ITEMIZED_PREFIX = "Itemized from Project:"


def engine(db_name: str):
    return sqa.create_engine(sqa.engine.URL.create(
        "mssql+pymssql", username=DB_USERNAME, password=***REMOVED***
        host=DB_HOSTNAME, database=db_name,
    ))


def _in_list(values):
    return ", ".join("'" + v.replace("'", "''") + "'" for v in values)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--program-id", action="append", dest="program_ids")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--target", default=TARGET_DB_NAME)
    parser.add_argument("--source", default=SOURCE_DB_NAME)
    args = parser.parse_args(argv)

    program_ids = ALL_PROGRAM_IDS if args.all else (args.program_ids or [])
    if not program_ids:
        parser.error("give --program-id (repeatable) or --all")

    target = engine(args.target)
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 20)
    ids = _in_list(program_ids)
    failed = False

    print(f"target {args.target}, source {args.source}")

    # 1. COUNT
    #
    # Against ATTACHABLE source notes, not every source note. A note is attached to the
    # CHILD's revision, so one whose child has no live revision on the target has nowhere to
    # go and is not a loader failure — it is a gap in the source. GAA 2024 SSP has exactly
    # one (P00851066VS: a note naming P00830018LS, with no dbo.project row behind it).
    # Those are counted separately below and reported, not failed.
    counts = pd.read_sql_query(f"""
        SELECT src.ProgramId, src.SourceNotes, src.Attachable, ISNULL(tgt.TargetNotes, 0) AS TargetNotes,
               ISNULL(tgt.TargetNotes, 0) - src.Attachable AS Difference,
               src.SourceNotes - src.Attachable AS UnattachableInSource
        FROM (
            /*  LEFT JOIN, not SUM(CASE WHEN EXISTS(...)): SQL Server refuses to aggregate
                over a subquery ("Cannot perform an aggregate function on an expression
                containing an aggregate or a subquery"). */
            SELECT h.programid AS ProgramId, COUNT(*) AS SourceNotes,
                   SUM(CASE WHEN rev.ProjectId IS NULL THEN 0 ELSE 1 END) AS Attachable
            FROM [{args.source}].dbo.history h
            LEFT JOIN (
                SELECT DISTINCT ProjectId, ProgramId FROM dbo.tProjectRevisions
            ) rev ON rev.ProjectId = h.projectid AND rev.ProgramId = h.programid
            WHERE h.programid IN ({ids})
              AND (h.[description] LIKE 'Itemized from Project:%'
                   OR h.[description] LIKE 'Cost reduced due to itemization%')
            GROUP BY h.programid
        ) src
        LEFT JOIN (
            SELECT r.ProgramId, COUNT(*) AS TargetNotes
            FROM dbo.tProjectNotes n
            JOIN dbo.tProjectRevisions r ON r.Id = n.ProjectRevisionFK
            WHERE r.ProgramId IN ({ids})
              AND (n.[Description] LIKE 'Itemized from Project:%'
                   OR n.[Description] LIKE 'Cost reduced due to itemization%')
            GROUP BY r.ProgramId
        ) tgt ON tgt.ProgramId = src.ProgramId
        ORDER BY src.ProgramId
    """, target)
    print("\n--- 1. notes per program, target vs source ---")
    print(counts.to_string(index=False) if not counts.empty else "(no itemization notes in the source)")
    if not counts.empty:
        loaded = counts[counts["TargetNotes"] > 0]
        if not loaded.empty and (loaded["Difference"] != 0).any():
            failed = True
            print("FAIL: a loaded program's note count does not match its attachable source notes")
        not_loaded = counts[counts["TargetNotes"] == 0]["ProgramId"].tolist()
        if not_loaded:
            print(f"(not loaded yet, skipped: {', '.join(not_loaded)})")
        # Only over LOADED programs: an unloaded one has no revisions at all, so every one of
        # its notes counts as unattachable and would drown the real gaps.
        stranded = int(loaded["UnattachableInSource"].sum()) if not loaded.empty else 0
        if stranded:
            print(f"({stranded} source note(s) in loaded programs name a child with no "
                  "revision on the target - source gaps, reported not failed)")

    # 2. LINKS
    links = pd.read_sql_query(f"""
        SELECT r.ProgramId, r.ProjectId AS Child,
               LTRIM(RTRIM(SUBSTRING(n.[Description], {len(ITEMIZED_PREFIX)} + 1, 60))) AS Parent,
               CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.tProjectRevisions pr
                    WHERE pr.ProjectId = LTRIM(RTRIM(SUBSTRING(n.[Description], {len(ITEMIZED_PREFIX)} + 1, 60)))
                      AND pr.IsDeleted = 0)
                    THEN 1 ELSE 0 END AS ParentResolves
        FROM dbo.tProjectNotes n
        JOIN dbo.tProjectRevisions r ON r.Id = n.ProjectRevisionFK
        WHERE r.ProgramId IN ({ids}) AND n.[Description] LIKE 'Itemized from Project:%'
    """, target)
    print("\n--- 2. 'Itemized from Project' links ---")
    if links.empty:
        print("(none)")
    else:
        summary = links.groupby(["ProgramId", "ParentResolves"]).size().reset_index(name="links")
        print(summary.to_string(index=False))
        unresolved = links[links["ParentResolves"] == 0]
        if not unresolved.empty:
            print(f"\n{len(unresolved)} link(s) name a parent with no live revision on the target:")
            print(unresolved[["ProgramId", "Child", "Parent"]].head(20).to_string(index=False))
            print("(reported, not failed — these are source data gaps)")

    # 3. DUPLICATES
    dupes = pd.read_sql_query(f"""
        SELECT TOP 20 r.ProgramId, r.ProjectId, n.[Description], n.CreatedDate, COUNT(*) AS copies
        FROM dbo.tProjectNotes n
        JOIN dbo.tProjectRevisions r ON r.Id = n.ProjectRevisionFK
        WHERE r.ProgramId IN ({ids})
        GROUP BY r.ProgramId, r.ProjectId, n.[Description], n.CreatedDate
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    """, target)
    print("\n--- 3. duplicate notes ---")
    if dupes.empty:
        print("OK: no note written twice")
    else:
        failed = True
        print(f"FAIL: {len(dupes)} duplicated note(s) — the loader's NOT EXISTS guard did not hold")
        print(dupes.to_string(index=False))

    print("\nRESULT:", "FAIL" if failed else "OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
