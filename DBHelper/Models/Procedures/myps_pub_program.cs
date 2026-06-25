using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class myps_pub_program
    {
        [Key]
        [Required]
        public int Id { get; set; }
        [Required]
        public string program_id { get; set; } = string.Empty;
        [Required]
        public string myps_project_id { get; set; } = string.Empty;
        [Required]
        public string project_description { get; set; } = string.Empty;
        [Required]
        public string implementing_office_id { get; set; } = string.Empty;
        [Required]
        public int infra_year { get; set; }
        public int? emergency_code { get; set; }
    }
}
