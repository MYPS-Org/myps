using System.Net.Http;
using System.Threading.Tasks;
using DBHelper.Models.Extra;
using System.Xml.Linq;

namespace Helpers.API
{
    public class PIS : XMLRequest<EmployeeResponse>
    {
        private readonly string _employeeId;
        
        public PIS(string employeeId) : base((string)null) 
        {
            _employeeId = employeeId;
        }

        internal override string RequestUri => Appsetting.PIS.Host;

        protected override string GetSoapBody()
        {
            return $@"<pis_get_employee xmlns=""https://www.dpwh.gov.ph/"">
                        <employee_id>{_employeeId}</employee_id>
                    </pis_get_employee>";
        }

        internal override async Task<EmployeeResponse> ReadResponseContent(HttpContent responseContent)
        {
            var xml = await responseContent.ReadAsStringAsync();

            // Simple XML parsing (adjust as needed for your real SOAP response)
            var doc = XDocument.Parse(xml);
            var ns = "https://www.dpwh.gov.ph/";

            var result = doc.Descendants(XName.Get("pis_get_employeeResult", ns)).FirstOrDefault();
            if (result == null) return null;

            return new EmployeeResponse
            {
                EmployeeId = result.Element(XName.Get("employee_id", ns))?.Value,
                NetworkId = result.Element(XName.Get("network_id", ns))?.Value,
                PersonFamilyName = result.Element(XName.Get("person_family_name", ns))?.Value,
                PersonForename = result.Element(XName.Get("person_forename", ns))?.Value,
                PersonMiddleInitial1 = result.Element(XName.Get("person_middle_initial_1", ns))?.Value,
                PositionCode = result.Element(XName.Get("position_code", ns))?.Value,
                PlantillaPosition = result.Element(XName.Get("plantilla_position", ns))?.Value,
                PlantillaOfficeId = result.Element(XName.Get("plantilla_office_id", ns))?.Value,
                PlantillaOfficeName = result.Element(XName.Get("plantilla_office_name", ns))?.Value,
                BureauServiceRoDeoId = result.Element(XName.Get("bureau_service_ro_deo_id", ns))?.Value,
                BureauServiceRoDeoName = result.Element(XName.Get("bureau_service_ro_deo_name", ns))?.Value,
                CentralOrRegionId = result.Element(XName.Get("central_or_region_id", ns))?.Value,
                CentralOrRegionName = result.Element(XName.Get("central_or_region_name", ns))?.Value,
                DesignationGroup = result.Element(XName.Get("designation_group", ns))?.Value,
                DesignationCode = result.Element(XName.Get("designation_code", ns))?.Value,
                DesignationTitle = result.Element(XName.Get("designation_title", ns))?.Value,
                DesignationOfficeId = result.Element(XName.Get("designation_office_id", ns))?.Value,
                DesignationOfficeName = result.Element(XName.Get("designation_office_name", ns))?.Value,
                DesignationStartDate = result.Element(XName.Get("designation_start_date", ns))?.Value,
                DesignationEndDate = result.Element(XName.Get("designation_end_date", ns))?.Value
            };
        }
    }
}