using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Extra
{
    public class EmployeeResponse
    {
        public string? EmployeeId { get; set; }
        public string? NetworkId { get; set; }
        public string? PersonFamilyName { get; set; }
        public string? PersonForename { get; set; }
        public string? PersonMiddleInitial1 { get; set; }
        public string? PositionCode { get; set; }
        public string? PlantillaPosition { get; set; }
        public string? PlantillaOfficeId { get; set; }
        public string? PlantillaOfficeName { get; set; }
        public string? BureauServiceRoDeoId { get; set; }
        public string? BureauServiceRoDeoName { get; set; }
        public string? CentralOrRegionId { get; set; }
        public string? CentralOrRegionName { get; set; }
        public string? DesignationGroup { get; set; }
        public string? DesignationCode { get; set; }
        public string? DesignationTitle { get; set; }
        public string? DesignationOfficeId { get; set; }
        public string? DesignationOfficeName { get; set; }
        public string? DesignationStartDate { get; set; }
        public string? DesignationEndDate { get; set; }
    }
}
