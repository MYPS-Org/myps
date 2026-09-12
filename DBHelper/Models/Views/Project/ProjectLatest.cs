using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views.Project
{
    public class ProjectLatest
    {
        [Key]
        public int Id { get; set; }

        /*  COMPUTED, NOT A COLUMN. True for a Lump Sum Project — tProjects.ProjectType
            'LS' with no ParentProjectId — so the Project List can hand it to the Lump
            Sum module (/lumpsum/{Id}: this Id is tProjects.Id, the same key
            vLumpSumSet exposes) instead of the ordinary project form. Itemized
            children are 'LS' too but have a parent, and stay ordinary projects.

            vProjectLatest carries neither ProjectType nor ParentProjectId and is not
            defined in this repository, so ShowProjects fills this in after the page
            query with one keyed lookup on tProjects. The ProjectId suffix is not a
            substitute: legacy rows exist whose IDs end in 'LS' and are not Lump Sum
            Projects. FromSql ignores NotMapped members, so the view query is
            unchanged. */
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public bool IsLumpSum { get; set; }
        public int RevisionId { get; set; }
        public int? StageFK { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string? ProgramName { get; set; }
        public string? StageName { get; set; }
        public int Category { get; set; }
        public string? CategoryName { get; set; }
        public string Description { get; set; } = string.Empty;
        /*  NULLABLE ON PURPOSE. A Lump Sum Project covers a programme, not a
            site, so Region and Implementing Office are optional under the V2
            field spec — LumpSum.Baseline.sql widened the columns and
            CreateLumpSum writes NULL deliberately. Declaring these non-nullable
            made EF throw while materialising the view, which took down the
            WHOLE project list: one Lump Sum row in the result set was enough.

            Do not "tidy" these back to string. The NULL is correct data. */
        public string? Region { get; set; }
        public string? ImplementingOffice { get; set; }
        public DateTime CreatedDate { get; set; }
        public string? LastUpdatedBy { get; set; }
        public DateTime? LastUpdatedDate { get; set; }
        public string RevisionCreatedBy { get; set; } = string.Empty;
        public DateTime RevisionCreatedDate { get; set; }
        public string Source { get; set; } = string.Empty;
    }
}
