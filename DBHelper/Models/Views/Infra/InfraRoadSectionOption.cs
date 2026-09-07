using System;

namespace DBHelper.Models.Views.Infra
{
    /// <summary>
    /// Backed by dbo.vInfraRoadSectionOptions - joins tFutureRoadSections to
    /// tFutureRoads (RoadName) and tUsers (CreatedByName/UpdatedByName) for
    /// the "pick a road section for a work location" flow.
    /// </summary>
    public class InfraRoadSectionOption
    {
        public int Id { get; set; }
        public string RoadId { get; set; } = string.Empty;
        public string RoadSectionId { get; set; } = string.Empty;
        public string? RoadName { get; set; }
        public double LengthM { get; set; }
        public string DEOParticipantId { get; set; } = string.Empty;
        public string? RegionParticipantId { get; set; }
        public int NetworkStatusId { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string? CreatedByName { get; set; }
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public string? UpdatedByName { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
