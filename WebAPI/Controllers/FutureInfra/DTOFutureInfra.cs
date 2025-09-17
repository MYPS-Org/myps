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
    public class ShowFutureRoadsDTO : EnumPagination
    {
        public ShowFutureRoadsFilterDTO Filters { get; set; } = new ShowFutureRoadsFilterDTO();
        public string SortField { get; set; } = "Id";
    }
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
        [MaxLength(10)]
        public string Classification { get; set; } = string.Empty;
    }
    #endregion
    #region Road Sections
    public class ShowFutureRoadSectionsDTO : EnumPagination
    {
        public ShowFutureRoadSectionsFilterDTO Filters { get; set; } = new ShowFutureRoadSectionsFilterDTO();
        public string SortField { get; set; } = "Id";
    }
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
    #endregion
    #region Bridges
    public class ShowFutureBridgeDTO : EnumPagination
    {
        public ShowFutureBridgeFilterDTO Filters { get; set; } = new ShowFutureBridgeFilterDTO();
        public string SortField { get; set; } = "Id";
    }
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
        [MaxLength(100)]
        public string From { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Length { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CarriageWay { get; set; } = string.Empty;
    }
    #endregion
}
