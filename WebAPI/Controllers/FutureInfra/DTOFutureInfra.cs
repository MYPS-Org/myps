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
    /// <summary>
    /// A list request whose column headers can sort it (S06-TC001-P001). SortField is the column the
    /// list names (e.g. "Name"); each endpoint maps it through a fixed dictionary, unknown names are
    /// ignored. sortDirection: 0 = ascending, 1 = descending.
    /// </summary>
    public class SortableFutureInfraPagination<T> : EnumPagination<T>
    {
        public string? SortField { get; set; }
        public int sortDirection { get; set; } = 1;
    }
    #region Roads
    public class ShowFutureRoadsDTO : SortableFutureInfraPagination<ShowFutureRoadsFilterDTO> { }
    public class ShowFutureRoadsFilterDTO
    {
        public string? Name { get; set; }
        public string? RoadId { get; set; }
        public string? Classification { get; set; }
    }
    public class AddFutureRoadsDTO
    {
        // No RoadId: the API generates the next FR#####{IslandCode} (S06-TC003-P001).
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
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
    public class ShowFutureRoadSectionsDTO : SortableFutureInfraPagination<ShowFutureRoadSectionsFilterDTO> { }
    public class ShowFutureRoadSectionsFilterDTO
    {
        public string? RoadId { get; set; }
        public string? RoadSectionId { get; set; }
        public string? DEO { get; set; }
    }
    public class AddFutureRoadSectionsDTO
    {
        // No RoadSectionId: the API generates FS#####{road island} (S06-TC005-P001).
        [Required]
        [MaxLength(100)]
        public string RoadId { get; set; } = string.Empty;
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
        // Ignored on input: the API derives it (the section number + the road's island code).
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
    public class ShowFutureBridgeDTO : SortableFutureInfraPagination<ShowFutureBridgeFilterDTO> { }
    public class ShowFutureBridgeFilterDTO
    {
        public string? RoadSectionId { get; set; }
        public string? BridgeId { get; set; }
        public string? Name { get; set; }
    }
    public class AddFutureBridgeDTO
    {
        // No BridgeId: the API generates FB#####{section island} (S06-TC010-P001).
        [Required]
        [MaxLength(100)]
        public string RoadSectionId { get; set; } = string.Empty;
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
        // Ignored on input: the API derives it (the bridge number + the section's island code).
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
    #region Infra Selection (Project/Revision work-location picker - DEO required, unlike the Rbia-admin Show* actions above)
    public class ShowInfraRoadSectionsDTO : EnumPagination<ShowInfraRoadSectionsFilterDTO> { }
    public class ShowInfraRoadSectionsFilterDTO
    {
        [Required]
        public string DEO { get; set; } = string.Empty;
        public string? RoadName { get; set; }
    }
    public class ShowInfraBridgesDTO : EnumPagination<ShowInfraBridgesFilterDTO> { }
    public class ShowInfraBridgesFilterDTO
    {
        [Required]
        public string DEO { get; set; } = string.Empty;
        public string? BridgeName { get; set; }
        public string? RoadSectionId { get; set; }
    }
    #endregion
}
