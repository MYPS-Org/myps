using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Views.Lumpsum;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WebAPI.MicroService;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// LS (Lumpsum) Wallet module — Phase 1: read-only.
    ///
    /// A wallet is a budget container owned by a Program. AIP projects are
    /// "itemized" against it (tProjects.ParentWalletId + ProjectType = 'LS') and
    /// draw down its balance. Wallets themselves are never published to PCMA —
    /// only the itemized projects under them are.
    ///
    /// All reads go through DB views:
    ///   vLSWalletLatest      wallet grid (+ joined balance and project count)
    ///   vLSWalletProjectSet  the itemized projects of a wallet
    ///   vLSWalletBalance     live Total / Used / Available
    /// </summary>
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class LumpsumController : CoreController
    {
        public LumpsumController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        #region Lumpsum Lists

        /// <summary>Dropdown sources for the wallet list filter bar.</summary>
        [HttpPost]
        public async Task<IActionResult> InitFilterLumpsum(CancellationToken cancellationToken)
        {
            try
            {
                // Only programs that actually have a wallet — filtering by a program
                // with no wallets can never return a row.
                var Programs = await _db.vLSWalletLatest
                    .AsNoTracking()
                    .Select(x => new { x.ProgramFK, x.ProgramId, x.ProgramName, x.YearStart })
                    .Distinct()
                    .OrderBy(x => x.ProgramName)
                    .ToListAsync(cancellationToken);

                var Stages = await _db.tOptionProgramStage
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.NameId)
                    .ToListAsync(cancellationToken);

                var Categories = await _db.tOptionProjectCategory
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.CategoryName)
                    .ToListAsync(cancellationToken);

                var OperatingUnits = await _db.vLSWalletLatest
                    .AsNoTracking()
                    .Where(x => x.OperatingUnit != null)
                    .Select(x => x.OperatingUnit)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToListAsync(cancellationToken);

                return Ok(new
                {
                    Programs,
                    Stages,
                    Categories,
                    OperatingUnits
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        /// <summary>Paged LS Wallet grid.</summary>
        [HttpPost]
        public async Task<IActionResult> ShowLumpsum([FromBody] ShowLumpsumDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(string Clause, string ParamName, object? Value)>();

                if (!string.IsNullOrWhiteSpace(dto.Filters.ProgramFK))
                    filters.Add(("v.ProgramFK = @ProgramFK", "@ProgramFK", dto.Filters.ProgramFK.Trim()));

                if (!string.IsNullOrWhiteSpace(dto.Filters.ProgramName))
                    filters.Add(("v.ProgramName LIKE @ProgramName", "@ProgramName", $"%{dto.Filters.ProgramName.Trim()}%"));

                if (!string.IsNullOrWhiteSpace(dto.Filters.CurrentStage))
                    filters.Add(("v.CurrentStage = @CurrentStage", "@CurrentStage", dto.Filters.CurrentStage.Trim()));

                if (!string.IsNullOrWhiteSpace(dto.Filters.OperatingUnit))
                    filters.Add(("v.OperatingUnit = @OperatingUnit", "@OperatingUnit", dto.Filters.OperatingUnit.Trim()));

                if (dto.Filters.CategoryId.HasValue)
                    filters.Add(("v.CategoryId = @CategoryId", "@CategoryId", dto.Filters.CategoryId.Value));

                if (dto.Filters.YearStart.HasValue)
                    filters.Add(("v.YearStart = @YearStart", "@YearStart", dto.Filters.YearStart.Value));

                // Row-level data security: restrict to wallets whose program is
                // visible to the session's region. vLSWalletLatest.ProgramFK is the
                // program's string key, so match on ProgramPK (not the int ProgramFK).
                if (_Session.ApplyFilter)
                    filters.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramPK = v.ProgramFK AND d.ParticipantId = @regCode)",
                        "@regCode",
                        _Session.RegCode));

                FilterDataResult<LSWalletLatest> result =
                    await _db.FilterDataCursor<LSWalletLatest, ShowLumpsumFilterDTO>(
                        tableName: "vLSWalletLatest",
                        dto: dto,
                        filter: filters,
                        keyColumn: "Id",
                        descending: true,
                        includeTotal: true,
                        ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(new ErrorResult
                    {
                        Title = "Pagination error",
                        Message = result.ErrorMessage ?? "Unable to retrieve the records."
                    });
                }

                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Lumpsum Details

        /// <summary>A single wallet plus its live balance.</summary>
        [HttpPost]
        public async Task<IActionResult> LumpsumDetails([FromBody] LumpsumDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var Wallet = await _db.vLSWalletLatest
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.WalletId, cancellationToken);

                if (Wallet == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Wallet {dto.WalletId} was not found.",
                        Title = "Not Found"
                    });
                }

                if (_Session.ApplyFilter && !await IsWalletVisible(Wallet.ProgramFK, cancellationToken))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "You do not have access to this wallet.",
                        Title = "Access Denied"
                    });
                }

                var Balance = await _db.vLSWalletBalance
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.WalletId == dto.WalletId, cancellationToken);

                return Ok(new
                {
                    Wallet,
                    // Falls back to the wallet row so the client always gets a
                    // balance object, even before any balance row materializes.
                    Balance = Balance ?? new LSWalletBalance
                    {
                        WalletId = Wallet.Id,
                        Total = Wallet.Total,
                        Used = Wallet.Used,
                        Available = Wallet.Available
                    }
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>Live Total / Used / Available for one wallet.</summary>
        [HttpPost]
        public async Task<IActionResult> WalletBalance([FromBody] WalletBalanceDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var Balance = await _db.vLSWalletBalance
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.WalletId == dto.WalletId, cancellationToken);

                if (Balance == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Wallet {dto.WalletId} was not found.",
                        Title = "Not Found"
                    });
                }

                return Ok(Balance);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Itemized Projects

        /// <summary>
        /// Paged set of itemized projects under a wallet. Only ProjectType = 'LS'
        /// rows with a live revision appear — the view enforces both.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ShowItemizedProjects([FromBody] ShowItemizedProjectsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var WalletExists = await _db.tLSWallets
                    .AsNoTracking()
                    .AnyAsync(x => x.Id == dto.Filters.WalletId && !x.IsDeleted, cancellationToken);

                if (!WalletExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Wallet {dto.Filters.WalletId} was not found.",
                        Title = "Not Found"
                    });
                }

                var filters = new List<(string Clause, string ParamName, object? Value)>
                {
                    ("v.ParentWalletId = @WalletId", "@WalletId", dto.Filters.WalletId)
                };

                if (!string.IsNullOrWhiteSpace(dto.Filters.ProjectId))
                    filters.Add(("v.ProjectId LIKE @ProjectId", "@ProjectId", $"%{dto.Filters.ProjectId.Trim()}%"));

                if (dto.Filters.IsPublished.HasValue)
                    filters.Add(("v.IsPublished = @IsPublished", "@IsPublished", dto.Filters.IsPublished.Value));

                FilterDataResult<LSWalletProjectSet> result =
                    await _db.FilterDataCursor<LSWalletProjectSet, ShowItemizedProjectsFilterDTO>(
                        tableName: "vLSWalletProjectSet",
                        dto: dto,
                        filter: filters,
                        keyColumn: "Id",
                        descending: true,
                        includeTotal: true,
                        ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(new ErrorResult
                    {
                        Title = "Pagination error",
                        Message = result.ErrorMessage ?? "Unable to retrieve the records."
                    });
                }

                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Helpers

        /// <summary>
        /// True when the wallet's parent program is visible to the session user.
        /// Reuses dbo.fUserVisiblePrograms — the same single-record visibility
        /// check ProgramController.ShowProgramStages performs.
        /// Only called when _Session.ApplyFilter is set.
        /// </summary>
        private async Task<bool> IsWalletVisible(string programFK, CancellationToken cancellationToken)
        {
            return await _db.fUserVisiblePrograms
                .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisiblePrograms({_Session.UserId})")
                .AnyAsync(x => x.ProgramPK == programFK, cancellationToken);
        }

        #endregion
    }
}
