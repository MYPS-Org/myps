using System.Globalization;

namespace Helpers
{
    /// <summary>Where a future bridge may sit on its road section (S06-TC010-P001).</summary>
    public static class BridgePlacement
    {
        /// <summary>
        /// The refusal message for a bridge's From Chainage and Length on a section of this length, or null when
        /// they fit. From is a distance in metres along the section, so it must lie between 0 and the section's
        /// length. The bridge's Length may run past the section's end: in the RBIA data a section boundary can
        /// fall mid-bridge (52 of 9,343 bridges on myps_db_dev).
        /// </summary>
        public static string? Refusal(double from, double length, double sectionLengthM, string sectionId)
        {
            if (!double.IsFinite(length) || length <= 0)
            {
                return "Bridge Length must be greater than 0 m.";
            }

            if (!double.IsFinite(from) || from < 0 || from > sectionLengthM)
            {
                return $"From Chainage must be between 0 and {Meters(sectionLengthM)} m, the length of road section {sectionId}.";
            }

            return null;
        }

        /// <summary>
        /// The refusal message for giving a section a Length shorter than where one of its bridges starts, or
        /// null. <paramref name="furthestBridgeFrom"/> is the largest From Chainage on the section (null: none).
        /// </summary>
        public static string? ShortenRefusal(double newLengthM, double? furthestBridgeFrom) =>
            furthestBridgeFrom is double from && newLengthM < from
                ? $"A bridge on this road section starts at {Meters(from)} m, so its Length cannot be less than {Meters(from)} m."
                : null;

        private static string Meters(double meters) => meters.ToString("0.##", CultureInfo.InvariantCulture);
    }
}
