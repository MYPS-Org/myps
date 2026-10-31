using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using static Helpers.MultiYear.PlanningImportRules;

namespace WebAPI.Controllers.MultiYear
{
    /// <summary>
    /// Phase 2: importing planning projects into an open RDIP or UDIP from a template (MY-PFL-17).
    /// Synchronous, like the Lump Sum import. The template's columns are PlanningImportRules.Columns,
    /// then Amount 1 ... Amount N (Start Year + k - 1, any number of columns); a Lists sheet holds the
    /// codes and names a list column accepts. Each row is added through AddPlanningProjectCoreAsync --
    /// the same checks, MY id and status New as Add Planning Project -- in its own transaction, so a
    /// refused row never stops the others; each refused row comes back with its row number.
    /// </summary>
    public partial class MultiYearController
    {
        private const long PlanningImportMaxBytes = 10L * 1024 * 1024;
        private const int TemplateAmountColumns = 10;
        private const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        /// <summary>The lists a template row may name, for one portfolio.</summary>
        private sealed record ImportLists(
            IReadOnlyList<Option> Categories, IReadOnlyList<Option> SubCategories, IReadOnlyList<Option> Regions,
            IReadOnlyList<(Option Option, string Region)> Provinces, IReadOnlyList<(Option Option, string Province)> Cities,
            IReadOnlyList<(Option Option, string Province)> Districts, IReadOnlyList<(Option Option, string Region)> DEOs,
            IReadOnlyList<(Option Option, string Region)> ImplementingOffices, IReadOnlyList<Option> AllRegions,
            IReadOnlyList<Option> RegionWides, IReadOnlyList<Option> HorizonTypes, IReadOnlyList<Option> InfraTypes,
            IReadOnlyList<Option> WorkTypes, IReadOnlyList<Option> Tiers, IReadOnlyList<Option> Basis,
            IReadOnlyList<Option> Neda, IReadOnlyList<Option> Readiness, IReadOnlyList<Option> RdpOutcomes,
            IReadOnlyList<(Option Option, string Outcome)> RdpOutputs);

        private async Task<ImportLists> LoadImportListsAsync(MultiYearPortfolio portfolio, CancellationToken ct)
        {
            var allRegions = await _db.tOptionAdminAreaRegion.AsNoTracking().Where(r => !r.Deprecated).OrderBy(r => r.Name)
                .Select(r => new { r.ParticipantId, r.Name }).ToListAsync(ct);
            var regions = portfolio.Kind == EnumPortfolioKind.RDIP ? allRegions.Where(r => r.ParticipantId == portfolio.OwnerParticipantId).ToList() : allRegions;
            var regionIds = regions.Select(r => r.ParticipantId).ToHashSet();
            var provinces = await _db.tOptionAdminAreaProvince.AsNoTracking().Where(p => regionIds.Contains(p.RegionParticipantId) && !p.Deprecated)
                .OrderBy(p => p.Name).Select(p => new { p.Code, p.Name, p.RegionParticipantId }).ToListAsync(ct);
            var provinceCodes = provinces.Select(p => p.Code).ToHashSet();
            var cities = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().Where(c => provinceCodes.Contains(c.ProvinceCode) && !c.Deprecated)
                .OrderBy(c => c.Name).Select(c => new { c.Code, c.Name, c.ProvinceCode }).ToListAsync(ct);
            var districts = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().Where(d => provinceCodes.Contains(d.ProvinceCode) && !d.Deprecated)
                .OrderBy(d => d.Name).Select(d => new { d.Code, d.Name, d.ProvinceCode }).ToListAsync(ct);
            var deos = await _db.vAdminDEO.AsNoTracking().Where(d => d.RegionParticipantId != null && regionIds.Contains(d.RegionParticipantId))
                .OrderBy(d => d.Name).Select(d => new { d.ParticipantId, d.Name, d.RegionParticipantId }).ToListAsync(ct);
            var offices = portfolio.Kind == EnumPortfolioKind.UDIP
                ? new()
                : await _db.vAdminImplementingOffice.AsNoTracking().Where(o => o.RegionParticipantId != null && regionIds.Contains(o.RegionParticipantId))
                    .OrderBy(o => o.Name).Select(o => new { o.ParticipantId, o.Name, o.RegionParticipantId }).ToListAsync(ct);
            var outcomes = await _db.tOptionRdpOutcome.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);
            var outcomeNames = outcomes.ToDictionary(o => o.Id, o => o.Name);

            return new ImportLists(
                (await _db.tOptionProjectCategory.AsNoTracking().OrderBy(c => c.CategoryName).Select(c => new { c.CategoryId, c.CategoryName }).ToListAsync(ct))
                    .Select(c => new Option(c.CategoryId.ToString(), c.CategoryName)).ToList(),
                (await _db.tOptionProjectThrustList.AsNoTracking().OrderBy(t => t.ThrustDescription).Select(t => new { t.PAPKey, t.ThrustDescription }).ToListAsync(ct))
                    .Select(t => new Option(t.PAPKey.ToString(), t.ThrustDescription)).ToList(),
                regions.Select(r => new Option(r.ParticipantId, r.Name)).ToList(),
                provinces.Select(p => (new Option(p.Code, p.Name), p.RegionParticipantId)).ToList(),
                cities.Select(c => (new Option(c.Code, c.Name), c.ProvinceCode)).ToList(),
                districts.Select(d => (new Option(d.Code, d.Name), d.ProvinceCode)).ToList(),
                deos.Select(d => (new Option(d.ParticipantId, d.Name), d.RegionParticipantId!)).ToList(),
                offices.Select(o => (new Option(o.ParticipantId, o.Name), o.RegionParticipantId!)).ToList(),
                allRegions.Select(r => new Option(r.ParticipantId, r.Name)).ToList(),
                (await _db.tOptionRegionWide.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct)).Select(x => new Option(x.NameId.ToString(), x.Name)).ToList(),
                (await _db.tOptionMultiYearType.AsNoTracking().Where(h => h.IsActive).OrderBy(h => h.Years == null).ThenBy(h => h.Years).ToListAsync(ct))
                    .Select(h => new Option(h.Id.ToString(), h.Name)).ToList(),
                (await _db.tOptionInfraType.AsNoTracking().Where(i => i.IsActive).OrderBy(i => i.InfraName).Select(i => new { i.InfraCode, i.InfraName }).ToListAsync(ct))
                    .Select(i => new Option(i.InfraCode, i.InfraName)).ToList(),
                (await _db.tOptionScopeOfWork.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.Description).Select(s => new { s.Enum, s.Description }).ToListAsync(ct))
                    .Select(s => new Option(s.Enum.ToString(), s.Description)).ToList(),
                (await _db.tOptionProjectTier.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct)).Select(x => new Option(x.NameId.ToString(), x.Name)).ToList(),
                (await _db.tOptionBasisForImplementation.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct)).Select(x => new Option(x.Id.ToString(), x.Name)).ToList(),
                (await _db.tOptionNedaProjectStatus.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct)).Select(x => new Option(x.Id.ToString(), x.Name)).ToList(),
                (await _db.tOptionReadinessLevel.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct)).Select(x => new Option(x.Id.ToString(), x.Name)).ToList(),
                outcomes.Select(o => new Option(o.Id.ToString(), o.Name)).ToList(),
                (await _db.tOptionRdpOutput.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct))
                    .Select(o => (new Option(o.Id.ToString(), o.Name), outcomeNames.TryGetValue(o.OutcomeFK, out var n) ? n : o.OutcomeFK.ToString())).ToList());
        }

        /// <summary>The import template for an open RDIP or UDIP: the projects sheet, the Lists sheet and
        /// the instructions.</summary>
        [HttpPost]
        public async Task<IActionResult> DownloadPlanningTemplate([FromBody] PortfolioIdDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (portfolio!.Kind == EnumPortfolioKind.PIP)
                    return Refused("Not Allowed", "Projects are imported into an RDIP or UDIP. They enter the PIP from there, through Add to PIP.");

                var lists = await LoadImportListsAsync(portfolio, cancellationToken);
                string name = await PortfolioNameAsync(portfolio, cancellationToken);
                using var package = new ExcelPackage();

                var sheet = package.Workbook.Worksheets.Add(ProjectsSheet);
                var headers = Columns.Concat(Enumerable.Range(1, TemplateAmountColumns).Select(AmountHeader)).ToList();
                for (int i = 0; i < headers.Count; i++)
                    sheet.Cells[1, i + 1].Value = headers[i];
                using (var header = sheet.Cells[1, 1, 1, headers.Count])
                {
                    header.Style.Font.Bold = true;
                    header.Style.Fill.PatternType = ExcelFillStyle.Solid;
                    header.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(221, 235, 247));
                }
                sheet.View.FreezePanes(2, 2);
                for (int i = 1; i <= headers.Count; i++)
                    sheet.Column(i).Width = i == 1 ? 50 : 22;

                var listSheet = package.Workbook.Worksheets.Add(ListsSheet);
                int column = 1;
                void Block(string title, IEnumerable<(string Code, string Name, string? Extra)> rows, string? extraTitle = null)
                {
                    listSheet.Cells[1, column].Value = $"{title} code";
                    listSheet.Cells[1, column + 1].Value = title;
                    if (extraTitle != null) listSheet.Cells[1, column + 2].Value = extraTitle;
                    int width = extraTitle == null ? 2 : 3;
                    listSheet.Cells[1, column, 1, column + width - 1].Style.Font.Bold = true;
                    int row = 2;
                    foreach (var (code, text, extra) in rows)
                    {
                        listSheet.Cells[row, column].Value = code;
                        listSheet.Cells[row, column + 1].Value = text;
                        if (extraTitle != null) listSheet.Cells[row, column + 2].Value = extra;
                        row++;
                    }
                    for (int i = 0; i < width; i++) listSheet.Column(column + i).Width = i == 1 ? 40 : 14;
                    column += width + 1;
                }
                static IEnumerable<(string, string, string?)> Plain(IEnumerable<Option> options) => options.Select(o => (o.Code, o.Name, (string?)null));
                var provinceNames = lists.Provinces.ToDictionary(p => p.Option.Code, p => p.Option.Name);
                Block("Category", Plain(lists.Categories));
                Block("Sub-Category", Plain(lists.SubCategories));
                Block("Region", Plain(lists.Regions));
                Block("Province", lists.Provinces.Select(p => (p.Option.Code, p.Option.Name, (string?)null)));
                Block("City / Municipality", lists.Cities.Select(c => (c.Option.Code, c.Option.Name, (string?)(provinceNames.TryGetValue(c.Province, out var n) ? n : c.Province))), "Province");
                Block("Legislative District", lists.Districts.Select(d => (d.Option.Code, d.Option.Name, (string?)(provinceNames.TryGetValue(d.Province, out var n) ? n : d.Province))), "Province");
                Block("District Engineering Office", lists.DEOs.Select(d => (d.Option.Code, d.Option.Name, (string?)null)));
                if (portfolio.Kind == EnumPortfolioKind.RDIP)
                    Block("Implementing Office", lists.ImplementingOffices.Select(o => (o.Option.Code, o.Option.Name, (string?)null)));
                Block("Reporting Region", Plain(lists.AllRegions));
                Block("Region Wide", Plain(lists.RegionWides));
                Block("Horizon Type", Plain(lists.HorizonTypes));
                Block("Infrastructure Type", Plain(lists.InfraTypes));
                Block("Dominant Type of Work", Plain(lists.WorkTypes));
                Block("Tier", Plain(lists.Tiers));
                Block("Basis for Implementation", Plain(lists.Basis));
                Block("NEDA Project Status", Plain(lists.Neda));
                Block("Readiness Level", Plain(lists.Readiness));
                Block("RDP Outcome", Plain(lists.RdpOutcomes));
                Block("RDP Output", lists.RdpOutputs.Select(o => (o.Option.Code, o.Option.Name, (string?)o.Outcome)), "RDP Outcome");
                listSheet.View.FreezePanes(2, 1);

                var help = package.Workbook.Worksheets.Add("Instructions");
                string[] lines =
                {
                    $"Planning projects for {name}.",
                    $"One project per row of the \"{ProjectsSheet}\" sheet, starting on row 2. Do not rename, move or delete the columns.",
                    "Required: Description, Category, Horizon Type, Start Year, Infrastructure Type, Dominant Type of Work and Amount 1."
                        + (portfolio.Kind == EnumPortfolioKind.UDIP ? " Region is required too." : " The Region is this RDIP's region; it may be left blank."),
                    "List columns take the code or the exact name from the Lists sheet. City / Municipality and Legislative District are looked up in the row's Province.",
                    "Readiness Levels: several separated by \";\". RDP Outcomes: \"Outcome > Output\" pairs separated by \";\", one output per outcome.",
                    "Amount 1 is the planned cost of the Start Year, Amount 2 of the next year, and so on. Add more Amount columns (Amount 11, Amount 12 ...) if you need them.",
                    "Fill every year from the Start Year to the last year with a cost: a blank amount before a filled one is refused, as is a zero amount.",
                    $"At most {MaxRows} rows. Each row is added on its own as a New project with its own MY id; a refused row is listed with its row number and the others are still added.",
                };
                for (int i = 0; i < lines.Length; i++)
                    help.Cells[i + 1, 1].Value = lines[i];
                help.Column(1).Width = 140;

                var bytes = await package.GetAsByteArrayAsync(cancellationToken);
                return File(bytes, XlsxContentType, $"PlanningProjects_{portfolio.Kind}_{portfolio.TermStartYear}.xlsx");
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>Imports a filled template into an open RDIP or UDIP. Answers what was added and each
        /// refused row with its messages.</summary>
        [HttpPost]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(PlanningImportMaxBytes)]
        public async Task<IActionResult> ImportPlanningProjects([FromForm] ImportPlanningProjectsFormDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (portfolio!.Kind == EnumPortfolioKind.PIP)
                    return Refused("Not Allowed", "Projects are imported into an RDIP or UDIP. They enter the PIP from there, through Add to PIP.");
                if (dto.File == null || dto.File.Length == 0)
                    return Refused("No File", "Choose the filled template to import.");
                if (!dto.File.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                    return Refused("Wrong File Type", "Upload the template as an .xlsx file.");

                using var stream = new MemoryStream();
                await dto.File.CopyToAsync(stream, cancellationToken);
                stream.Position = 0;
                using var package = new ExcelPackage(stream);
                var sheet = package.Workbook.Worksheets[ProjectsSheet];
                if (sheet == null)
                    return Refused("Not the Template", $"The file has no \"{ProjectsSheet}\" sheet. Download the template and fill it in.");

                int lastColumn = sheet.Dimension?.End.Column ?? 0;
                var headers = Enumerable.Range(1, Math.Max(lastColumn, Columns.Length)).Select(c => (string?)sheet.Cells[1, c].Text).ToList();
                if (HeaderRefusal(headers, out int amountColumns) is string headerRefusal)
                    return Refused("Unexpected Column Layout", headerRefusal);

                int lastRow = sheet.Dimension?.End.Row ?? 1;
                var rows = new List<(int Row, string?[] Cells)>();
                for (int r = 2; r <= lastRow; r++)
                {
                    var cells = Enumerable.Range(1, Columns.Length + amountColumns).Select(c => (string?)sheet.Cells[r, c].Text).ToArray();
                    if (cells.All(string.IsNullOrWhiteSpace)) continue;
                    rows.Add((r, cells));
                }
                if (rows.Count == 0)
                    return Refused("Nothing to Import", $"The \"{ProjectsSheet}\" sheet has no rows to import.");
                if (rows.Count > MaxRows)
                    return Refused("Too Many Rows", $"The file has {rows.Count} rows; import at most {MaxRows} at a time.");

                var lists = await LoadImportListsAsync(portfolio, cancellationToken);
                string reason = $"Imported into {await PortfolioNameAsync(portfolio, cancellationToken)}.";
                var added = new List<object>();
                var errors = new List<object>();
                foreach (var (row, cells) in rows)
                {
                    var (request, rowErrors) = ReadPlanningRow(cells, amountColumns, portfolio, lists);
                    if (rowErrors.Count > 0)
                    {
                        errors.Add(new { Row = row, Messages = rowErrors });
                        continue;
                    }
                    try
                    {
                        var (result, rowRefusal) = await AddPlanningProjectCoreAsync(request!, portfolio, reason, cancellationToken);
                        if (rowRefusal != null)
                            errors.Add(new { Row = row, Messages = new[] { RefusalMessage(rowRefusal) } });
                        else
                            added.Add(new { Row = row, result!.Project.ProjectId, result.Warnings });
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        // This row's transaction rolled back: log it, forget its unsaved entities, go on.
                        _exceptionHandler.Handle(ex, new { dto.PortfolioId, Row = row }, _Session.UserId.ToString());
                        _db.ChangeTracker.Clear();
                        errors.Add(new { Row = row, Messages = new[] { "The row could not be saved. Check its values and import it again." } });
                    }
                }

                return Ok(new
                {
                    Added = added,
                    Errors = errors,
                    Message = errors.Count == 0
                        ? $"{added.Count} planning project{(added.Count == 1 ? "" : "s")} imported."
                        : $"{added.Count} planning project{(added.Count == 1 ? "" : "s")} imported; {errors.Count} row{(errors.Count == 1 ? " was" : "s were")} refused.",
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, new { dto.PortfolioId, File = dto.File?.FileName }, _Session.UserId.ToString());
            }
        }

        /// <summary>One template row as an Add Planning Project request, or the row's problems.</summary>
        private static (AddPlanningProjectDTO? Request, List<string> Errors) ReadPlanningRow(string?[] cells, int amountColumns, MultiYearPortfolio portfolio, ImportLists lists)
        {
            var errors = new List<string>();
            string? Cell(string column) => cells[ColumnIndex(column)];
            string? Pick(string column, IReadOnlyList<Option> options, bool required)
            {
                var (code, error) = Resolve(Cell(column), options, column, required);
                if (error != null) errors.Add(error);
                return code;
            }
            int? PickInt(string column, IReadOnlyList<Option> options, bool required) =>
                Pick(column, options, required) is string code && int.TryParse(code, out int value) ? value : null;

            string description = (Cell("Description") ?? string.Empty).Trim();
            if (description.Length == 0) errors.Add("Description is required.");

            int? category = PickInt("Category", lists.Categories, required: true);
            int? subCategory = PickInt("Sub-Category", lists.SubCategories, required: false);

            string? region;
            if (portfolio.Kind == EnumPortfolioKind.RDIP)
            {
                // An RDIP's projects are in its region: the Lists sheet offers only that one.
                region = portfolio.OwnerParticipantId;
                Pick("Region", lists.Regions, required: false);
            }
            else
                region = Pick("Region", lists.Regions, required: true);

            string? province = Pick("Province", lists.Provinces.Where(p => p.Region == region).Select(p => p.Option).ToList(), required: false);
            string? city = null, district = null;
            if (province == null && (!string.IsNullOrWhiteSpace(Cell("City / Municipality")) || !string.IsNullOrWhiteSpace(Cell("Legislative District"))))
                errors.Add("Enter the Province to give a City / Municipality or Legislative District.");
            else if (province != null)
            {
                city = Pick("City / Municipality", lists.Cities.Where(c => c.Province == province).Select(c => c.Option).ToList(), required: false);
                district = Pick("Legislative District", lists.Districts.Where(d => d.Province == province).Select(d => d.Option).ToList(), required: false);
            }
            string? deo = Pick("District Engineering Office", lists.DEOs.Where(d => d.Region == region).Select(d => d.Option).ToList(), required: false);
            string? office = portfolio.Kind == EnumPortfolioKind.RDIP
                ? Pick("Implementing Office", lists.ImplementingOffices.Where(o => o.Region == region).Select(o => o.Option).ToList(), required: false)
                : null;
            string? reportingRegion = Pick("Reporting Region", lists.AllRegions, required: false);
            int? regionWide = PickInt("Region Wide", lists.RegionWides, required: false);
            int? horizon = PickInt("Horizon Type", lists.HorizonTypes, required: true);

            var (startYear, startError) = ReadYear(Cell("Start Year"), "Start Year", required: true);
            if (startError != null) errors.Add(startError);
            var (endYear, endError) = ReadYear(Cell("End Year"), "End Year", required: false);
            if (endError != null) errors.Add(endError);

            string? infra = Pick("Infrastructure Type", lists.InfraTypes, required: true);
            int? workType = PickInt("Dominant Type of Work", lists.WorkTypes, required: true);
            var (target, targetError) = ReadNumber(Cell("Physical Target"), "Physical Target");
            if (targetError != null) errors.Add(targetError);

            int? tier = PickInt("Tier", lists.Tiers, required: false);
            int? basis = PickInt("Basis for Implementation", lists.Basis, required: false);
            int? neda = PickInt("NEDA Project Status", lists.Neda, required: false);
            var readiness = new List<int>();
            foreach (string part in SplitList(Cell("Readiness Levels")))
            {
                var (code, error) = Resolve(part, lists.Readiness, "Readiness Level", required: true);
                if (error != null) errors.Add(error);
                else readiness.Add(int.Parse(code!));
            }
            var rdp = new List<RdpPickDTO>();
            foreach (string part in SplitList(Cell("RDP Outcomes")))
            {
                var pair = part.Split('>', 2);
                if (pair.Length != 2)
                {
                    errors.Add($"RDP Outcomes \"{part}\" must be written as \"Outcome > Output\".");
                    continue;
                }
                var (outcomeCode, outcomeError) = Resolve(pair[0], lists.RdpOutcomes, "RDP Outcome", required: true);
                if (outcomeError != null) { errors.Add(outcomeError); continue; }
                string outcomeName = lists.RdpOutcomes.First(o => o.Code == outcomeCode).Name;
                var (outputCode, outputError) = Resolve(pair[1], lists.RdpOutputs.Where(o => o.Outcome == outcomeName).Select(o => o.Option).ToList(), "RDP Output", required: true);
                if (outputError != null) { errors.Add($"{outputError} (under {outcomeName})"); continue; }
                rdp.Add(new RdpPickDTO { OutcomeId = int.Parse(outcomeCode!), OutputId = int.Parse(outputCode!) });
            }
            var (mca, mcaError) = ReadNumber(Cell("MCA Score"), "MCA Score");
            if (mcaError != null) errors.Add(mcaError);

            var years = new List<MultiYearCostRules.YearAmount>();
            if (startYear is int start)
            {
                var amounts = ReadAmounts(start, cells.Skip(Columns.Length).Take(amountColumns).ToList());
                errors.AddRange(amounts.Errors);
                years.AddRange(amounts.Years);
            }

            if (errors.Count > 0)
                return (null, errors);
            return (new AddPlanningProjectDTO
            {
                PortfolioId = portfolio.Id,
                Description = description,
                Category = category!.Value,
                Thrust = subCategory,
                Region = region,
                Province = province,
                City = city,
                LegislativeDistrict = district,
                DEO = deo,
                ImplementingOffice = office,
                ReportingRegion = reportingRegion,
                RegionWide = regionWide,
                HorizonTypeId = horizon!.Value,
                StartYear = startYear!.Value,
                EndYear = endYear,
                Component = new PlanningComponentDTO { InfraTypeFK = infra!, WorkTypeFK = workType!.Value, PhysicalTarget = target is decimal t ? (double)t : null },
                YearlyCosts = years.Select(y => new YearAmountDTO { Year = y.Year, Amount = y.Amount }).ToList(),
                Membership = new MembershipFieldsDTO
                {
                    BasisForImplementationId = basis,
                    NedaProjectStatusId = neda,
                    ReadinessLevelIds = readiness,
                    RdpOutcomes = rdp,
                    Tier = tier,
                    McaScore = mca,
                },
            }, errors);
        }
    }
}
