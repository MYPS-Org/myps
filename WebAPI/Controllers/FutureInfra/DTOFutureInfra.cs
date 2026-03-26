using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Programs
{
    #region Roads
    public class ShowFutureRoadsDTO : EnumPagination<ShowFutureRoadsFilterDTO> { }
    public class ShowFutureRoadsFilterDTO
    {
        public string? Name { get; set; }
        public string? RoadId { get; set; }
        public string? Classification { get; set; }
    }
    public class AddFutureRoadsDTO
    {
        [Required]
        [MaxLength(100)]
        public string RoadId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public int Classification { get; set; }
    }
    public class EditFutureRoadsDTO
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string RoadId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public int Classification { get; set; }
    }
    public class DeleteFutureRoadDTO
    {
        [Required]
        [MaxLength(100)]
        public string RoadId { get; set; } = string.Empty;
    }
    #endregion
    #region Road Sections
    public class ShowFutureRoadSectionsDTO : EnumPagination<ShowFutureRoadSectionsFilterDTO> { }
    public class ShowFutureRoadSectionsFilterDTO
    {
        public string? RoadId { get; set; }
        public string? RoadSectionId { get; set; }
        public string? DEO { get; set; }
    }
    public class AddFutureRoadSectionsDTO
    {
        [Required]
        [MaxLength(100)]
        public string RoadId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RoadSectionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string RoadLength { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string DEO { get; set; } = string.Empty;
    }
    public class EditFutureRoadSectionsDTO
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string RoadId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string RoadSectionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string RoadLength { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string DEO { get; set; } = string.Empty;
    }
    public class DeleteFutureRoadSectionDTO
    {
        [Required]
        [MaxLength(100)]
        public string RoadSectionId { get; set; } = string.Empty;
    }
    #endregion
    #region Bridges
    public class ShowFutureBridgeDTO : EnumPagination<ShowFutureBridgeFilterDTO> { }
    public class ShowFutureBridgeFilterDTO
    {
        public string? RoadSectionId { get; set; }
        public string? BridgeId { get; set; }
        public string? Name { get; set; }
    }
    public class AddFutureBridgeDTO
    {
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
        public double From { get; set; }
        [Required]
        public double Length { get; set; }
        [Required]
        public double CarriageWay { get; set; }
        [Required]
        public double OverallWidth { get; set; }
    }
    public class EditFutureBridgeDTO
    {
        [Required]
        public int Id { get; set; }
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
        public double From { get; set; }
        [Required]
        public double Length { get; set; }
        [Required]
        public double CarriageWay { get; set; }
        [Required]
        public double OverallWidth { get; set; }
    }
    public class DeleteFutureBridgeDTO
    {
        [Required]
        [MaxLength(100)]
        public string BridgeId { get; set; } = string.Empty;
    }
    #endregion
}
