"""READ-ONLY check that component costs landed at one row per (revision, component).

WHY

build_project_component_cost_sql used to select the per-year columns alongside a correlated
SUM and rely on SELECT DISTINCT to collapse them. DISTINCT cannot collapse rows that differ,
so a component with N distinct (cost, dates) shapes became N component rows, each carrying
the component's whole Total. The per-year query then joined its rows to every copy.

Two checks, both SELECT only:

  1. GRAIN — (ProjectRevisionFK, ComponentId) pairs with more than one live row. Must be 0.
     Reported with the copy count so a regression says how bad it is.

  2. TOTALS — per (project, program, component), the target's live Total against the source's
     SUM(projectcoststream.cost). Must match to the cent. This is the check that would catch
     a GROUP BY that grouped away real rows as well as duplicate ones.

Scoped to the ProgramPKs given, so it says nothing about data loaded before the fix. Run it
after every group.

Usage (repo root, pixi env python):
    python -m app.data_migration.test_sql.verify_component_grain \\
        --program-pk MP_P_CO-PS-535_09102022_074918
    python -m app.data_migration.test_sql.verify_component_grain --all-2023-2025

Exit code 1 if either check fails.
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

# The four groups steps_for_2023_2025_groups loads.
ALL_PROGRAM_PKS = [
    "MP_P_CO-PS-291_08222022_145740",  # 2023 CSSP
    "MP_P_CO-PS-535_09102022_074918",  # 2023 LP
    "MP_P_CO-PS-282_08232022_121112",  # 2023 OO-1
    "MP_P_CO-PS-800_07152024_143901",  # 2025 OO-1
]


def engine(db_name: str):
    return sqa.create_engine(sqa.engine.URL.create(
        "mssql+pymssql", username=DB_USERNAME, password=***REMOVED***
        host=DB_HOSTNAME, database=db_name,
    ))


def _in_list(values):
    return ", ".join("'" + v.replace("'", "''") + "'" for v in values)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--program-pk", action="append", dest="program_pks")
    parser.add_argument("--all-2023-2025", action="store_true")
    parser.add_argument("--target", default=TARGET_DB_NAME)
    parser.add_argument("--source", default=SOURCE_DB_NAME)
    args = parser.parse_args(argv)

    program_pks = ALL_PROGRAM_PKS if args.all_2023_2025 else (args.program_pks or [])
    if not program_pks:
        parser.error("give --program-pk (repeatable) or --all-2023-2025")

    target = engine(args.target)
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 20)
    pks = _in_list(program_pks)
    failed = False

    print(f"target {args.target}, source {args.source}")
    print("program keys: " + ", ".join(program_pks))

    # 1. GRAIN
    grain = pd.read_sql_query(f"""
        SELECT copies, COUNT(*) AS pairs FROM (
            SELECT cc.ProjectRevisionFK, cc.ComponentId, COUNT(*) AS copies
            FROM dbo.tProjectComponentCost cc
            JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK
            WHERE r.ProgramFK IN ({pks}) AND cc.IsDeleted = 0
            GROUP BY cc.ProjectRevisionFK, cc.ComponentId
        ) x GROUP BY copies ORDER BY copies
    """, target)
    print("\n--- 1. rows per (revision, component) ---")
    print(grain.to_string(index=False) if not grain.empty else "(no components)")
    duplicated = int(grain.loc[grain["copies"] > 1, "pairs"].sum()) if not grain.empty else 0
    if duplicated:
        failed = True
        print(f"FAIL: {duplicated} pair(s) carry more than one live row")
        print(pd.read_sql_query(f"""
            SELECT TOP 10 r.ProjectId, r.ProgramId, cc.ComponentId, COUNT(*) AS copies, MIN(cc.Total) AS total_each
            FROM dbo.tProjectComponentCost cc
            JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK
            WHERE r.ProgramFK IN ({pks}) AND cc.IsDeleted = 0
            GROUP BY r.ProjectId, r.ProgramId, cc.ComponentId HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        """, target).to_string(index=False))
    else:
        print("OK: one live row per (revision, component)")

    # 2. TOTALS against the source
    totals = pd.read_sql_query(f"""
        SELECT TOP 20 t.ProjectId, t.ProgramId, t.ComponentId, t.TargetTotal, s.SourceTotal,
               t.TargetTotal - s.SourceTotal AS Difference
        FROM (
            SELECT r.ProjectId, r.ProgramId, cc.ComponentId, SUM(cc.Total) AS TargetTotal
            FROM dbo.tProjectComponentCost cc
            JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK
            WHERE r.ProgramFK IN ({pks}) AND cc.IsDeleted = 0
            GROUP BY r.ProjectId, r.ProgramId, cc.ComponentId
        ) t
        JOIN (
            SELECT cs.projectid AS ProjectId, cs.programid AS ProgramId,
                   COALESCE(cs.component, '') AS ComponentId, SUM(cs.cost) AS SourceTotal
            FROM [{args.source}].dbo.projectcoststream cs
            GROUP BY cs.projectid, cs.programid, COALESCE(cs.component, '')
        ) s ON s.ProjectId = t.ProjectId AND s.ProgramId = t.ProgramId AND s.ComponentId = t.ComponentId
        WHERE ABS(t.TargetTotal - s.SourceTotal) > 0.005
        ORDER BY ABS(t.TargetTotal - s.SourceTotal) DESC
    """, target)
    print("\n--- 2. target Total vs source SUM(cost) ---")
    if totals.empty:
        print("OK: every component's Total matches the source")
    else:
        failed = True
        print(f"FAIL: {len(totals)} component(s) disagree (top 20)")
        print(totals.to_string(index=False))

    print("\nRESULT:", "FAIL" if failed else "OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
