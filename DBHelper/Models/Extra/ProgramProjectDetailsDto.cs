namespace DBHelper.Models.Extra
{
    public class ProgramProjectDetailsDto
    {
        public string ProgramId { get; set; }
        public string StageName { get; set; }
        public string ProjectId { get; set; }
        public string ProjectCategory { get; set; }
        public string Region { get; set; }
        public string ComponentId { get; set; }
        public decimal ComponentAmount { get; set; }
        public string ComponentDescription { get; set; }
        public string MW_ComponentId { get; set; }
        public string Measure { get; set; }
        public string WorkTypeDescription { get; set; }
    }
}
