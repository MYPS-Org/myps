using DBHelper.Models.Extra;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Security;
using System.Xml.Linq;

namespace Helpers.API
{
    public class GetUserInfoPIS : XMLRequest<EmployeeResponse>
    {
        private readonly string _employeeId;

        public GetUserInfoPIS(string employeeId)
        {
            _employeeId = employeeId;
        }

        protected override string SoapAction => "\"https://www.dpwh.gov.ph/pis_get_employee\"";
        internal override string RequestUri => Appsetting.PIS.Host;
        internal override bool Disabled => Appsetting.PIS.Disabled;

        // 2026-09-04: values interpolated into a SOAP body must be XML-escaped -- a raw
        // '&'/'<'/'>' in any of these (e.g. a password) produces malformed XML, a SOAP fault, and
        // an undiagnosable failure downstream in APIRequest.XML.
        protected override string GetSoapHeader()
        => $@"<UserDetails xmlns=""https://www.dpwh.gov.ph/"">
                        <userName>{SecurityElement.Escape(Appsetting.PIS.userName)}</userName>
                        <password>{SecurityElement.Escape(Appsetting.PIS.password)}</password>
                    </UserDetails>";
        protected override string GetSoapBody()
            => $@"<pis_get_employee xmlns=""https://www.dpwh.gov.ph/"">
                        <employee_id>{SecurityElement.Escape(_employeeId)}</employee_id>
                    </pis_get_employee>";

        internal override async Task<EmployeeResponse> ReadResponseContent(HttpContent responseContent)
        {
            var xml = await responseContent.ReadAsStringAsync();
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

    public class AuthenticatePIS : XMLRequest<string>
    {
        private readonly string _employeeId;
        private readonly string _password;

        public AuthenticatePIS(string employeeId, string password)
        {
            _employeeId = employeeId;
            _password = password;
        }

        protected override string SoapAction => "\"https://www.dpwh.gov.ph/ad_validate_login\"";
        internal override string RequestUri => Appsetting.PIS.Login;//Appsetting.PIS.Host;
        internal override bool Disabled => Appsetting.PIS.Disabled;

        protected override string GetSoapHeader() => string.Empty;
        // 2026-09-04: XML-escape both values -- see GetUserInfoPIS's GetSoapHeader comment above.
        protected override string GetSoapBody()
            => $@"<ad_validate_login xmlns=""https://www.dpwh.gov.ph/"">
                        <networkid>{SecurityElement.Escape(_employeeId)}</networkid>
                        <pw>{SecurityElement.Escape(_password)}</pw>
                    </ad_validate_login>";

        internal override async Task<string> ReadResponseContent(HttpContent responseContent)
        {
            var xml = await responseContent.ReadAsStringAsync();
            var doc = XDocument.Parse(xml);
            var ns = "https://www.dpwh.gov.ph/";
            var result = doc.Descendants(XName.Get("ad_validate_loginResult", ns)).FirstOrDefault();
            if (result == null) return null;

            // 2026-09-11 fix: .ToString() on an XElement serializes the whole element including
            // its tag/namespace (e.g. "<ad_validate_loginResult xmlns=...>...</ad_validate_loginResult>"),
            // which was leaking straight into the login error message shown to the user. .Value
            // is just the inner text PIS actually returned.
            return result.Value.Trim();
        }
    }
}