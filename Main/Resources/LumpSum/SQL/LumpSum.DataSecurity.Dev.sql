/* =============================================================================
   Lump Sum V2 — row-level data-security fixture, LOCAL DEV ONLY
   -----------------------------------------------------------------------------
   Creates the accounts needed to exercise AssertLumpSumVisibleAsync, which has
   never engaged once on this database.

   WHY IT WAS UNPROVABLE. The guard is skipped entirely when the session's
   ApplyFilter is 0, and on a restored myps_db_dev NO user has it set — 0 of 576.
   Not because the flag is missing: tGroups already has two groups carrying
   ApplyFilter = 1. It is because vUsers COMPUTES the flag as

       CASE WHEN EXISTS (a group of mine has ApplyFilter = 0) THEN 0 ELSE 1 END

   so a user is restricted only when EVERY group they belong to is restricted.
   All 569 Admin users, and the one account that does hold a restricted group,
   are also in Admin — so every user resolves to 0.

   THE TRAP THIS EXISTS TO PREVENT: adding a restricted group to an existing
   user does NOTHING. The account has to be in the restricted group and nothing
   else, or the fixture silently keeps behaving as unrestricted and every
   assertion built on it passes for the wrong reason.

   NOT FOR ANY SHARED OR PRODUCTION SERVER. It inserts fake user accounts that
   can sign in — see the login note below.

   Idempotent: re-running deletes these two accounts and re-creates them. It
   touches NO existing user, group, program or project row.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* -- 0. Guard: dev databases only -------------------------------------------
   These accounts sign in with ANY password, because Development runs with
   PIS.BypassLogin = true (AuthenticationController: "signing in without a
   password check"). That is harmless on a local restore and unacceptable
   anywhere else, so the script refuses to run on a database not named for dev.
   ---------------------------------------------------------------------------- */
IF DB_NAME() NOT LIKE '%dev%'
BEGIN
    PRINT 'SKIPPED: ' + DB_NAME() + ' is not a dev database. This script creates sign-in-able accounts.';
    SET NOEXEC ON;
END
GO

/* -- 1. A group of our own --------------------------------------------------
   tGroups already has 'DPD Admin' (5) and 'Test' (8) at ApplyFilter = 1, and
   either would work. A dedicated group is used instead so the fixture does not
   depend on what someone else means by "Test", and so changing this group can
   never affect a real user.
   ---------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.tGroups WHERE GroupName = N'LS E2E Restricted')
BEGIN
    INSERT dbo.tGroups (GroupName, Description, ApplyFilter, CreatedBy, CreatedDate)
    VALUES (N'LS E2E Restricted',
            N'Row-level data-security fixture for the Lump Sum e2e suite. Not a real group.',
            1, N'LumpSum.DataSecurity.Dev.sql', SYSDATETIME());
END
GO

DECLARE @GroupId int = (SELECT Id FROM dbo.tGroups WHERE GroupName = N'LS E2E Restricted');

/* Belt and braces: the whole fixture rests on this being 1. */
IF (SELECT ApplyFilter FROM dbo.tGroups WHERE Id = @GroupId) <> 1
BEGIN
    RAISERROR('LS E2E Restricted exists but ApplyFilter is 0 — the fixture would prove nothing.', 16, 1);
END

/* -- 2. The two accounts ----------------------------------------------------
   Both are restricted. They differ only in RegCode, which is what decides the
   verdict — fUserVisiblePrograms grants visibility on three alternatives, and
   RegCode drives two of them.

     e2elsdenied   RegCode OI19 = Abra District Engineering Office, whose region
                   is OI234 (Cordillera). Not a central office, so the
                   central-tier bypass does not fire; and neither OI19 nor OI234
                   appears in any Lump Sum program's DataSecurityGroup. DENIED.

     e2elsallowed  RegCode OI10 = Central Office, which vAdminOfficeRegion gives
                   a NULL region. That is the CENTRAL-TIER BYPASS — visibility is
                   granted structurally, independent of the group flag, because
                   "Central Office and UPMO should not have any filtering".
                   ALLOWED.

   WHAT THIS PAIR DOES NOT COVER. The third branch — a restricted REGIONAL user
   whose region IS in the program's DataSecurityGroup — cannot be reached
   without editing program data. Every Lump Sum Project sits on one program
   whose DataSecurityGroup is ["OI10"], and OI10 is an Office (Central Office),
   not a region, with no offices rolling up to it. To exercise that branch
   deliberately, add a region to that program:

       UPDATE dbo.tPrograms
          SET DataSecurityGroup = N'["OI10","OI234"]'
        WHERE ProgramPK = N'MP_P_CO-PS-535_03252025_073824';

   which would flip e2elsdenied to allowed. It is left out because it changes
   who can see that program in every other module too, and a fixture should not
   do that as a side effect.
   ---------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Fixture') IS NOT NULL DROP TABLE #Fixture;
CREATE TABLE #Fixture (
    UserId      nvarchar(50)  PRIMARY KEY,
    EmployeeId  nvarchar(50),
    Name        nvarchar(200),
    RegCode     nvarchar(50),
    Expected    nvarchar(20)
);

INSERT #Fixture (UserId, EmployeeId, Name, RegCode, Expected)
VALUES (N'e2elsdenied',  N'E2E-LS-DENIED',  N'E2E Lump Sum (denied, Cordillera)', N'OI19', N'DENIED'),
       (N'e2elsallowed', N'E2E-LS-ALLOWED', N'E2E Lump Sum (allowed, Central)',   N'OI10', N'ALLOWED');

/* Idempotency: scoped to exactly these two UserIds and nothing else. */
DELETE FROM dbo.tUserGroups WHERE UserId IN (SELECT UserId FROM #Fixture);
DELETE FROM dbo.tUsers      WHERE UserId IN (SELECT UserId FROM #Fixture);

INSERT dbo.tUsers (EmployeeId, UserId, Name, Email, RegCode, PlantillaOffice, IsActive)
SELECT f.EmployeeId, f.UserId, f.Name, f.UserId + N'@e2e.local', f.RegCode, f.RegCode, 1
FROM   #Fixture f;

/*  ONE GROUP ONLY. Adding any other group — Admin especially — would set
    ApplyFilter back to 0 and quietly disarm the whole fixture. */
INSERT dbo.tUserGroups (UserId, GroupIds, CreatedBy, CreatedDate)
SELECT f.UserId,
       N'[' + CAST(@GroupId AS nvarchar(12)) + N']',
       N'LumpSum.DataSecurity.Dev.sql',
       SYSDATETIME()
FROM   #Fixture f;
GO

/* -- 3. Grant the fixture group the Lump Sum actions and routes --------------
   WITHOUT THIS THE FIXTURE PROVES NOTHING, and does so convincingly.

   A group with no grants 403s on every action before the request ever reaches
   AssertLumpSumVisibleAsync:

       {"Message":"You do not have permission to perform 'LumpSumDetails'
                   on 'LumpsumController'.","Title":"Access Denied"}

   A spec asserting "the restricted user is refused" would pass on that, having
   tested the permission filter and never once exercised row-level visibility —
   the same "registration is not a grant" trap as decision 8, arriving inverted:
   a green test instead of a broken page.

   Granted deliberately NARROW: the thirteen Lump Sum actions, the three Lump Sum
   routes, and Dashboard — which is not Lump Sum's but is the app's landing route
   and therefore the difference between an account that can sign in and one that
   cannot. Nothing else. A fixture user who fails for an unrelated missing
   permission should be obvious rather than mysterious.
   ---------------------------------------------------------------------------- */
DECLARE @GroupId int = (SELECT Id FROM dbo.tGroups WHERE GroupName = N'LS E2E Restricted');
DECLARE @Controller nvarchar(50) = N'LumpsumController';

IF NOT EXISTS (SELECT 1 FROM dbo.tGroupRoles WHERE GroupId = @GroupId)
    INSERT dbo.tGroupRoles (GroupId, ActionIds, ViewIds) VALUES (@GroupId, N'[]', N'[]');

/*  AuthController.Validate IS NOT OPTIONAL, AND IS NOT LUMP SUM'S.

    A group without it cannot use the application AT ALL. Login itself is
    [AllowAnonymous] and succeeds, but the frontend immediately calls
    POST /auth/validate to establish the session — and Validate is NOT
    anonymous, so it 403s, AuthContext concludes there is no valid session, and
    the browser sits on /login. The user sees a login form that accepts their
    password and then returns them to the login form. Nothing anywhere says
    "permission".

    Cost an hour to find, because the API-level specs never hit it: they call
    /api/Auth/Login directly and use the cookie, never validating a session the
    way a browser does. Any group built through the RBAC UI needs this grant.

    Logout goes with it for the same reason — also not anonymous, and a user who
    cannot sign out is stuck. */
/*  THE IMPORT ACTIONS ARE NOT LUMP SUM'S EITHER, AND ARE JUST AS REQUIRED.

    'the import refuses too' builds a real workbook as the restricted user, and
    building one starts by fetching the template from ImportingController. Without
    these two the helper dies on

        DownloadTemplate answered 403: You do not have permission to perform
        'DownloadTemplate' on 'ImportingController'

    before ImportItemizedProjects is ever called — which is the SAME trap §2
    below describes for the Lump Sum actions themselves: a spec that means to
    prove "the visibility gate refuses this user" instead proves "this user was
    never allowed to ask", and would pass on a 403 having tested nothing.

    So the restricted group gets exactly what an entitled user has, and the only
    thing standing between it and the data is the guard under test. */
;WITH SessionActions AS (
    SELECT Id FROM dbo.tApiActions
    WHERE ControllerName = N'AuthController' AND ActionName IN (N'Validate', N'Logout')
),
ImportActions AS (
    SELECT Id FROM dbo.tApiActions
    WHERE ControllerName = N'ImportingController'
      AND ActionName COLLATE Latin1_General_BIN2 IN (N'DownloadTemplate', N'DownloadImportFile')
),
LumpSumActions AS (
    SELECT Id FROM dbo.tApiActions WHERE ControllerName = @Controller
),
Existing AS (
    SELECT a.ActionId AS Id
    FROM   dbo.tGroupRoles gr
    CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
    WHERE  gr.GroupId = @GroupId
),
Merged AS (
    SELECT Id FROM Existing
    UNION SELECT Id FROM LumpSumActions
    UNION SELECT Id FROM SessionActions
    UNION SELECT Id FROM ImportActions
)
UPDATE gr
   SET gr.ActionIds = (
        SELECT '[' + ISNULL(STUFF((
            SELECT ',' + CONVERT(varchar(12), Id) FROM Merged ORDER BY Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, ''), '') + ']')
FROM dbo.tGroupRoles gr
WHERE gr.GroupId = @GroupId;

/* Routes — the React router only registers a path whose RouteName is in the
   session's ViewAccess, so a UI spec needs these as well as the API grants.
   'AddWallet' keeps its wallet-era spelling: it is a tAppViews row, not a code
   symbol (plan decision 14).

   DASHBOARD IS IN THE LIST, AND HAS TO BE. It was left out at first, on the
   reasoning that a fixture should grant nothing it does not test. That made the
   accounts unable to sign in THROUGH THE UI at all: VITE_DEFAULT_ROUTE is
   /dashboard, usePermittedRoutes registers no route whose RouteName is absent
   from ViewAccess, so the post-login redirect had nowhere to land and every UI
   spec failed at the login form while the same account worked perfectly over
   the API. Every real user has this route; a fixture user without it is not a
   restricted user but a broken one. */
;WITH LumpSumViews AS (
    SELECT Id FROM dbo.tAppViews
    WHERE RouteName IN (N'LumpSumList', N'LumpSumDetails', N'AddWallet', N'Dashboard')
),
ExistingViews AS (
    SELECT v.ViewId AS Id
    FROM   dbo.tGroupRoles gr
    CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId INT '$') v
    WHERE  gr.GroupId = @GroupId
),
MergedViews AS (
    SELECT Id FROM ExistingViews UNION SELECT Id FROM LumpSumViews
)
UPDATE gr
   SET gr.ViewIds = (
        SELECT '[' + ISNULL(STUFF((
            SELECT ',' + CONVERT(varchar(12), Id) FROM MergedViews ORDER BY Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, ''), '') + ']')
FROM dbo.tGroupRoles gr
WHERE gr.GroupId = @GroupId;
GO

/* -- 4. Prove it, rather than assume it -------------------------------------
   Asserts the two things the fixture exists to provide: the accounts really do
   resolve to ApplyFilter = 1, and they really do disagree about the Lump Sum
   program. A fixture that silently grants both is worse than none.
   ---------------------------------------------------------------------------- */
PRINT '--- fixture accounts (ApplyFilter must be 1 for both) ---';

SELECT  u.UserId,
        u.UserGroupIds,
        u.ApplyFilter,
        Raw_RegCode = t.RegCode,
        VisiblePrograms = (SELECT COUNT(*) FROM dbo.fUserVisiblePrograms(u.UserId))
FROM    dbo.vUsers u
JOIN    dbo.tUsers t ON t.UserId = u.UserId
WHERE   u.UserId IN (N'e2elsdenied', N'e2elsallowed');
GO

PRINT '--- verdict per Lump Sum program (Denied must be 0 visible, Allowed must see it) ---';

SELECT  ProgramPK = p.ProgramFK,
        DeniedUserSees  = CASE WHEN EXISTS (SELECT 1 FROM dbo.fUserVisiblePrograms(N'e2elsdenied')  v WHERE v.ProgramPK = p.ProgramFK) THEN N'VISIBLE  <-- FIXTURE BROKEN' ELSE N'denied  OK' END,
        AllowedUserSees = CASE WHEN EXISTS (SELECT 1 FROM dbo.fUserVisiblePrograms(N'e2elsallowed') v WHERE v.ProgramPK = p.ProgramFK) THEN N'visible OK' ELSE N'DENIED   <-- FIXTURE BROKEN' END
FROM    (SELECT DISTINCT ProgramFK FROM dbo.vLumpSumSet) p;
GO

PRINT '--- grants (must equal the number of Lump Sum actions, or 403 hides everything) ---';

SELECT  LumpSumActionsRegistered = (SELECT COUNT(*) FROM dbo.tApiActions WHERE ControllerName = N'LumpsumController'),
        GrantedLumpSumActions    = (
            SELECT COUNT(*)
            FROM   dbo.tGroupRoles gr
            CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
            JOIN   dbo.tApiActions t ON t.Id = a.ActionId AND t.ControllerName = N'LumpsumController'
            WHERE  gr.GroupId = (SELECT Id FROM dbo.tGroups WHERE GroupName = N'LS E2E Restricted')),
        RoutesGranted            = (
            SELECT COUNT(*)
            FROM   dbo.tGroupRoles gr
            CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId INT '$') v
            JOIN   dbo.tAppViews w ON w.Id = v.ViewId
                                  AND w.RouteName IN (N'LumpSumList', N'LumpSumDetails', N'AddWallet', N'Dashboard')
            WHERE  gr.GroupId = (SELECT Id FROM dbo.tGroups WHERE GroupName = N'LS E2E Restricted'));
GO

SET NOEXEC OFF;
GO
PRINT 'LumpSum.DataSecurity.Dev.sql complete. Sign in as e2elsdenied / e2elsallowed with any password (Development only).';
GO
