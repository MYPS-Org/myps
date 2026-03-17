using Confluent.Kafka;
using DBHelper.Data;
using Helpers;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers.GlobalSearch
{
    [Route("api/[controller]/[action]")]
    public class GlobalSearchController : CoreController
    {
        // Security: only these view names are ever used in SQL — not user input
        private static readonly Dictionary<string, string> AllowedTableSqlNames = new()
        {
            { "vProjects",      "vProjects"      },
            { "vPrograms",      "vPrograms"       },
            { "vProjectGroups", "vProjectGroups"  },
            { "vUsers",         "vUsers"          },
            { "vRevisionLists", "vRevisionLists"  },
        };

        private static readonly Dictionary<string, string> TableLabels = new()
        {
            { "vProjects",      "Projects"       },
            { "vPrograms",      "Programs"       },
            { "vProjectGroups", "Project Groups" },
            { "vUsers",         "Users"          },
            { "vRevisionLists", "Revisions"      },
        };

        // Security: only these column names are ever used in SQL — not user input
        private static readonly Dictionary<string, List<(string Field, string Label)>> AllowedColumns = new()
        {
            {
                "vProjects", new()
                {
                    ("ProjectId",          "Project ID"),
                    ("Description",        "Description"),
                    ("ProgramName",        "Program Name"),
                    ("Category",           "Category"),
                    ("Region",             "Region"),
                    ("Province",           "Province"),
                    ("City",               "City"),
                    ("ImplementingOffice", "Implementing Office"),
                    ("DEO",                "DEO"),
                    ("StageName",          "Stage"),
                    ("AlternateId",        "Alternate ID"),
                    ("ExternalId",         "External ID"),
                    ("UACS",               "UACS"),
                    ("MYId",               "MY ID"),
                }
            },
            {
                "vPrograms", new()
                {
                    ("ProgramId",  "Program ID"),
                    ("Name",       "Program Name"),
                    ("StageName",  "Stage"),
                    ("Status",     "Status"),
                    ("Type",       "Type"),
                    ("YearStart",  "Year Start"),
                    ("CreatedBy",  "Created By"),
                }
            },
            {
                "vProjectGroups", new()
                {
                    ("GroupId",       "Group ID"),
                    ("Name",          "Group Name"),
                    ("Description",   "Description"),
                    ("UserGroupName", "User Group"),
                }
            },
            {
                "vUsers", new()
                {
                    ("UserId",          "User ID"),
                    ("Name",            "Name"),
                    ("Email",           "Email"),
                    ("PlantillaOffice", "Office"),
                    ("RegCode",         "Region Code"),
                }
            },
            {
                "vRevisionLists", new()
                {
                    ("TransactionId", "Transaction ID"),
                    ("RevisionName",  "Revision Name"),
                    ("CategoryName",  "Category"),
                    ("Reason",        "Reason"),
                    ("CreatedBy",     "Created By"),
                }
            },
        };

        public GlobalSearchController(AppDbContext db, IProducer<Null, string> producer)
            : base(db, producer) { }

        /// <summary>
        /// Returns the list of searchable tables available in global search.
        /// POST /api/GlobalSearch/GetTables
        /// </summary>
        [HttpPost]
        public IActionResult GetTables()
        {
            var tables = AllowedTableSqlNames.Keys.Select(key => new
            {
                Key = key,
                Label = TableLabels.TryGetValue(key, out var label) ? label : key
            }).ToList();

            return Ok(tables);
        }

        /// <summary>
        /// Returns the searchable columns for a given table key.
        /// POST /api/GlobalSearch/GetColumns
        /// Body: { "TableKey": "vProjects" }
        /// </summary>
        [HttpPost]
        public IActionResult GetColumns([FromBody] GetColumnsRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.TableKey) || !AllowedTableSqlNames.ContainsKey(req.TableKey))
                return BadRequest(new { Message = "Invalid or missing TableKey." });

            if (!AllowedColumns.TryGetValue(req.TableKey, out var cols))
                return BadRequest(new { Message = "No columns configured for this table." });

            var result = cols.Select(c => new { Field = c.Field, Label = c.Label }).ToList();
            return Ok(result);
        }

        /// <summary>
        /// Executes the global search query.
        /// POST /api/GlobalSearch/Search
        /// Body: { "TableKey": "vProjects", "ColumnField": "Description", "Value": "road" }
        /// Returns up to 50 matching rows.
        /// </summary>
        [HttpPost]
        public IActionResult Search([FromBody] GlobalSearchRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.TableKey))
                return BadRequest(new { Message = "TableKey is required." });
            if (string.IsNullOrWhiteSpace(req.ColumnField))
                return BadRequest(new { Message = "ColumnField is required." });
            if (string.IsNullOrWhiteSpace(req.Value))
                return BadRequest(new { Message = "Value is required." });

            // Validate table against whitelist
            if (!AllowedTableSqlNames.TryGetValue(req.TableKey, out var sqlTableName))
                return BadRequest(new { Message = "Invalid table." });

            // Validate column against whitelist
            if (!AllowedColumns.TryGetValue(req.TableKey, out var cols) ||
                !cols.Any(c => c.Field == req.ColumnField))
                return BadRequest(new { Message = "Invalid column for the selected table." });

            // Both sqlTableName and req.ColumnField come from our whitelist — safe to interpolate
            // The value is passed as a Dapper parameter — SQL injection safe
            var sql = $"SELECT TOP 50 * FROM [{sqlTableName}] WHERE CAST([{req.ColumnField}] AS NVARCHAR(MAX)) LIKE @Value";

            var parameters = new Dictionary<string, object>
            {
                { "@Value", $"%{req.Value.Trim()}%" }
            };

            var results = Sql.NormalQuery<dynamic>(Appsetting.ConnectionString, sql, parameters);

            return Ok(new
            {
                TableKey = req.TableKey,
                ColumnField = req.ColumnField,
                Value = req.Value,
                Total = results.Count,
                Data = results
            });
        }

        public class GetColumnsRequest
        {
            public string TableKey { get; set; } = string.Empty;
        }

        public class GlobalSearchRequest
        {
            public string TableKey { get; set; } = string.Empty;
            public string ColumnField { get; set; } = string.Empty;
            public string Value { get; set; } = string.Empty;
        }
    }
}
