using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Infra
{
    public class FutureBridge
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int NetworkStatusId { get; set; }
        [Required]
        public int InfraExistingOrFutureId { get; set; }
        [Required]
        [MaxLength(100)]
        public string RoadSectionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string BridgeId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public Double From { get; set; }
        [Required]
        public Double Length { get; set; }
        public Double? CarriageWay { get; set; }
        [Required]
        public Double OverallWidth { get; set; }
        [Required]
        [MaxLength(200)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(200)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}