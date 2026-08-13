using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionDocuments
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string DocumentName { get; set; } = string.Empty;
        [Required]
        public string DocumentPath { get; set; } = string.Empty;
        [Required]
        public bool IsApprovedDocument { get; set; }
    }
}
