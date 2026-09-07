using System;

namespace DBHelper.Models.Views.Infra
{
    /// <summary>
    /// Backed by dbo.vInfraBridgeOptions - joins tFutureBridge to
    /// tFutureRoadSections (DEOParticipantId/RegionParticipantId) and
    /// tUsers (CreatedByName/UpdatedByName) for the "pick a bridge for a
    /// work location" flow.
    /// </summary>
    public class InfraBridgeOption
    {
        public int Id { get; set; }
        public string BridgeId { get; set; } = string.Empty;
        public string RoadSectionId { get; set; } = string.Empty;
        public string? BridgeName { get; set; }
        public string? DEOParticipantId { get; set; }
        public string? RegionParticipantId { get; set; }
        public double FromChainage { get; set; }
        public double Length { get; set; }
        public double? CarriageWay { get; set; }
        public double OverallWidth { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string? CreatedByName { get; set; }
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public string? UpdatedByName { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
