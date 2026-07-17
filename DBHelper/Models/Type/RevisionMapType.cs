using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Type
{
    public class RevisionMapType
    {
        [Key]
        public int OldRevisionId { get; set; }
        public int NewRevisionId { get; set; }
    }
}