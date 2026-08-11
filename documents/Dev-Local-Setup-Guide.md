# Running MYPS Locally

This is a snapshot of what it took to get the backend and frontend running locally on the
`BE-refactor-update-project-details` branch (as of 2026-08-09). Update it if the upstream
issues below get fixed or the setup changes.

## Prerequisites

- **.NET SDK 8.0+** (`dotnet` CLI) — tested with 10.0.302. Visual Studio is *not* required;
  `Main` is a standard SDK-style ASP.NET Core project, so `dotnet build` / `dotnet run` work fine.
- **Node.js + npm** for the frontend.
- **VPN access** to the Eptisa dev network — required to reach:
  - SQL Server at `192.168.50.200` (`myps_db`, `Mock_PCMA`)
  - The PIS login service at `https://eptisa-dev.com` (used by `/api/Auth/Login`)

### VS Code extensions (optional but recommended)

None of these are required to *run* the app — everything below works from the plain
integrated terminal (`dotnet build`/`dotnet run`, `npm run dev`). They're worth installing for
a proper editing/debugging experience, since there's no `.vscode/extensions.json` in this repo
to prompt for them automatically:

| Extension | ID | Why |
|---|---|---|
| C# Dev Kit | `ms-dotnettools.csdevkit` | IntelliSense, build/debug (F5), solution explorer for the `Main`/`WebAPI`/`DBHelper`/etc. `.csproj` projects. Pulls in the base C# extension automatically. |
| ESLint | `dbaeumer.vscode-eslint` | `FE/eslint.config.js` exists; lints TS/TSX inline. |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Autocomplete/hover for Tailwind v4 classes (`FE/tailwind.config.js`). |

Everything else (Vite, React, TypeScript language features) works out of the box via VS Code's
built-in TypeScript support — no extra extension needed.

## 1. Backend (.NET)

### Known build issues on this branch

This branch has a few things that haven't caught up with the ongoing Project/Program schema
refactor. You'll hit these on a clean checkout — none of the fixes below are committed, so
you'll need to re-apply them if you pull fresh changes into this branch.

**a. Stray duplicate file.** `DBHelper/Models/Functions/Revision/RevisionQueue - Copy.cs` is a
broken copy-paste duplicate of `RevisionQueue.cs` (same fields, missing class name) and fails
to compile. Delete it:

```
rm "DBHelper/Models/Functions/Revision/RevisionQueue - Copy.cs"
```

**b. `RevisionController.cs` is out of sync with the schema.** It references tables/columns/views
(`vPrograms`, `fRevisionProjectDetails`, `OptionRevisionHeader`, etc.) that were removed or renamed
during the Project/Program refactor — around 90 compile errors. Exclude it from the build until
someone updates it to match the current schema, by adding this to `WebAPI/WebAPI.csproj`:

```xml
<ItemGroup>
  <Compile Remove="Controllers\Revision\RevisionController.cs" />
</ItemGroup>
```

This disables all Revision API endpoints until the file is fixed.

**c. `MYPSDbContext` DI registration conflict.** `Main/ServiceRegistration.cs` registers
`MYPSDbContext` via both `AddDbContext` and `AddPooledDbContextFactory`. In the Development
environment, ASP.NET Core's service-provider validation rejects this combination
(`AggregateException: Cannot consume scoped service 'DbContextOptions<MYPSDbContext>' from
singleton 'IDbContextPool<MYPSDbContext>'`), and the app crashes on startup. Fix by replacing
both registrations with a single pooled one:

```csharp
Services.AddDbContextPool<MYPSDbContext>(options => {
    options.UseSqlServer(Appsetting.DbConnections.MYPSDb);
    options.EnableSensitiveDataLogging();
    options.EnableDetailedErrors();
    options.LogTo(Console.WriteLine, LogLevel.Information);
});
```

`AddDbContextPool` provides both scoped `MYPSDbContext` injection and
`IDbContextFactory<MYPSDbContext>` from the same pool, so it covers what the two separate calls
were doing.

### Build & run

```powershell
dotnet build Main/Main.csproj

$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project Main --no-build -c Debug
```

The backend listens on `http://localhost:5015` (see `Main/Properties/launchSettings.json`).
Connection strings and external service URLs (SQL Server, PCMA DB, PIS login) live in
`Main/appsettings.Development.json`.

## 2. Frontend (React + Vite)

`FE/.env.development` controls which backend the frontend talks to. Point it at your local
backend instead of the remote dev tunnel:

```
# VITE_API_BASE_URL=https://myps.eptisa-dev.com
VITE_API_BASE_URL=http://localhost:5015
```

(comment the remote line out rather than deleting it, so it's easy to switch back)

```
cd FE
npm install
npm run dev
```

The dev server runs on `http://localhost:8080` (see `FE/vite.config.ts`) and proxies `/api/*`
requests to `VITE_API_BASE_URL`.

## 3. Login

`/api/Auth/Login` calls out to the PIS auth service at `https://eptisa-dev.com/auth.php`. If
login fails with an SSL/TLS error (e.g. "The SSL connection could not be established"), it
almost always means the VPN isn't connected — `eptisa-dev.com` resolves to an internal IP
(`192.168.50.200`) that's only reachable over VPN.

## Summary checklist

- [ ] VPN connected
- [ ] Delete `DBHelper/Models/Functions/Revision/RevisionQueue - Copy.cs`
- [ ] Exclude `RevisionController.cs` in `WebAPI/WebAPI.csproj`
- [ ] Consolidate `MYPSDbContext` registration in `Main/ServiceRegistration.cs` to `AddDbContextPool`
- [ ] `dotnet run --project Main` (Development env) → listens on `http://localhost:5015`
- [ ] `FE/.env.development` → `VITE_API_BASE_URL=http://localhost:5015`
- [ ] `npm run dev` in `FE/` → `http://localhost:8080`
