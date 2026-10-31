using DBHelper.Models.Table.MultiYear;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.MultiYear
{
    /*  The Multi-Year planning code lists (MY-PFL-14, -15), maintained on Code Tables > Multi-Year.
        Each value has Valid From / Valid To years (0 = open) and Active, and can be picked when it is
        Active OR valid for the year. A value is RETIRED, never deleted: there is no delete action, so
        a membership that chose it keeps it. Like Code Tables, a value in use cannot be renamed. */
    public partial class MultiYearController
    {
        private const string BasisList = "BasisForImplementation";
        private const string NedaList = "NedaProjectStatus";
        private const string ReadinessList = "ReadinessLevel";
        private const string OutcomeList = "RdpOutcome";
        private const string OutputList = "RdpOutput";

        [HttpPost]
        public async Task<IActionResult> ShowMultiYearCodeLists(CancellationToken cancellationToken)
        {
            try
            {
                return Ok(await CodeListsAsync(cancellationToken));
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        /// <summary>Adds (Id 0) or edits one value of one list. Answers every list, refreshed.</summary>
        [HttpPost]
        public async Task<IActionResult> SaveMultiYearCodeListItem([FromBody] SaveCodeListItemDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                string name = (dto.Name ?? string.Empty).Trim();
                string? description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
                int maxName = dto.List is OutcomeList or OutputList ? 250 : 150;
                if (name.Length == 0)
                    return Refused("Name Required", "Enter the name.");
                if (name.Length > maxName)
                    return Refused("Name Too Long", $"Name cannot exceed {maxName} characters.");
                if (description?.Length > 250)
                    return Refused("Description Too Long", "Description cannot exceed 250 characters.");
                if (dto.ValidFromYear < 0 || dto.ValidToYear < 0 || dto.ValidFromYear > 2100 || dto.ValidToYear > 2100)
                    return Refused("Invalid Validity", "Valid From and Valid To are years up to 2100, or 0 for no limit.");
                if (dto.ValidFromYear != 0 && dto.ValidToYear != 0 && dto.ValidFromYear > dto.ValidToYear)
                    return Refused("Invalid Validity", "Valid From cannot be after Valid To.");

                MultiYearCodeListItem? item;
                IQueryable<MultiYearCodeListItem> sameName;
                switch (dto.List)
                {
                    case BasisList:
                        item = dto.Id == 0 ? new OptionBasisForImplementation() : await _db.tOptionBasisForImplementation.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                        sameName = _db.tOptionBasisForImplementation.Where(x => x.Name == name && x.Id != dto.Id);
                        break;
                    case NedaList:
                        item = dto.Id == 0 ? new OptionNedaProjectStatus() : await _db.tOptionNedaProjectStatus.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                        sameName = _db.tOptionNedaProjectStatus.Where(x => x.Name == name && x.Id != dto.Id);
                        break;
                    case ReadinessList:
                        item = dto.Id == 0 ? new OptionReadinessLevel() : await _db.tOptionReadinessLevel.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                        sameName = _db.tOptionReadinessLevel.Where(x => x.Name == name && x.Id != dto.Id);
                        break;
                    case OutcomeList:
                        item = dto.Id == 0 ? new OptionRdpOutcome() : await _db.tOptionRdpOutcome.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                        sameName = _db.tOptionRdpOutcome.Where(x => x.Name == name && x.Id != dto.Id);
                        break;
                    case OutputList:
                        var output = dto.Id == 0 ? new OptionRdpOutput() : await _db.tOptionRdpOutput.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                        if (output == null)
                            return Refused("Not Found", "This value could not be found. Reload the list.");
                        int outcomeId = dto.OutcomeId ?? output.OutcomeFK;
                        if (!await _db.tOptionRdpOutcome.AsNoTracking().AnyAsync(o => o.Id == outcomeId, cancellationToken))
                            return Refused("Outcome Required", "Choose the RDP outcome this output belongs to.");
                        if (dto.Id != 0 && outcomeId != output.OutcomeFK && await CodeValueInUseAsync(OutputList, output.Id, cancellationToken))
                            return Refused("Value In Use", "This output is in use, so it cannot move to another outcome.");
                        output.OutcomeFK = outcomeId;
                        item = output;
                        sameName = _db.tOptionRdpOutput.Where(x => x.Name == name && x.OutcomeFK == outcomeId && x.Id != dto.Id);
                        break;
                    default:
                        return Refused("Invalid List", "Choose a Multi-Year code list.");
                }
                if (item == null)
                    return Refused("Not Found", "This value could not be found. Reload the list.");
                if (await sameName.AnyAsync(cancellationToken))
                    return Refused("Duplicate Name", $"'{name}' is already in this list.");
                if (dto.Id != 0 && item.Name != name && await CodeValueInUseAsync(dto.List, item.Id, cancellationToken))
                    return Refused("Value In Use", $"'{item.Name}' is in use, so it cannot be renamed. Retire it (Active off, or a Valid To year) and add a new value instead.");

                var now = Functions.CurrentDate();
                item.Name = name;
                item.Description = description;
                item.ValidFromYear = dto.ValidFromYear;
                item.ValidToYear = dto.ValidToYear;
                item.IsActive = dto.IsActive;
                if (dto.Id == 0)
                {
                    item.CreatedBy = _Session.UserId;
                    item.CreatedDate = now;
                    _db.Add(item);
                }
                else
                {
                    item.UpdatedBy = _Session.UserId;
                    item.UpdatedDate = now;
                }
                await _db.SaveChangesAsync(cancellationToken);

                return Ok(new { Lists = await CodeListsAsync(cancellationToken), Message = dto.Id == 0 ? $"'{name}' added." : $"'{name}' saved." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        private async Task<object> CodeListsAsync(CancellationToken ct)
        {
            var used = await UsedCodeValuesAsync(ct);
            object Rows<T>(IEnumerable<T> items, string list) where T : MultiYearCodeListItem =>
                items.OrderBy(x => x.Name).Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Description,
                    x.ValidFromYear,
                    x.ValidToYear,
                    x.IsActive,
                    OutcomeId = (x as OptionRdpOutput)?.OutcomeFK,
                    InUse = used.Contains((list, x.Id)),
                }).ToList();

            return new
            {
                BasisForImplementation = Rows(await _db.tOptionBasisForImplementation.AsNoTracking().ToListAsync(ct), BasisList),
                NedaProjectStatus = Rows(await _db.tOptionNedaProjectStatus.AsNoTracking().ToListAsync(ct), NedaList),
                ReadinessLevel = Rows(await _db.tOptionReadinessLevel.AsNoTracking().ToListAsync(ct), ReadinessList),
                RdpOutcome = Rows(await _db.tOptionRdpOutcome.AsNoTracking().ToListAsync(ct), OutcomeList),
                RdpOutput = Rows(await _db.tOptionRdpOutput.AsNoTracking().ToListAsync(ct), OutputList),
            };
        }

        private async Task<bool> CodeValueInUseAsync(string list, int id, CancellationToken ct) =>
            (await UsedCodeValuesAsync(ct)).Contains((list, id));

        /// <summary>Every (list, value) any membership holds, including the JSON multi-value fields.</summary>
        private async Task<HashSet<(string List, int Id)>> UsedCodeValuesAsync(CancellationToken ct)
        {
            var rows = await _db.tMultiYearPortfolioMember.AsNoTracking()
                .Select(m => new { m.BasisForImplementationFK, m.NedaProjectStatusFK, m.ReadinessLevelIds, m.RdpOutcomes })
                .ToListAsync(ct);
            var used = new HashSet<(string, int)>();
            foreach (var m in rows)
            {
                if (m.BasisForImplementationFK is int b) used.Add((BasisList, b));
                if (m.NedaProjectStatusFK is int n) used.Add((NedaList, n));
                foreach (int r in ReadIds(m.ReadinessLevelIds)) used.Add((ReadinessList, r));
                foreach (var pick in ReadRdp(m.RdpOutcomes))
                {
                    used.Add((OutcomeList, pick.OutcomeId));
                    used.Add((OutputList, pick.OutputId));
                }
            }
            return used;
        }
    }
}
