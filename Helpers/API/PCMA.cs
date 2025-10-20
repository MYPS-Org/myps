using System.Net.Http;
using System.Threading.Tasks;
using DBHelper.Models.Extra;
using System.Xml.Linq;
using DBHelper.Models.API;
using System.Text;

namespace Helpers.API
{
    public class PCMA : XMLRequest<PCMAResponse>
    {
        private readonly PublishPCMA _pcmaData;
        
        public PCMA(PublishPCMA pcmaData) : base((string)null) 
        {
            _pcmaData = pcmaData;
        }

        internal override string RequestUri => Appsetting.PIS.Host;

        protected override string GetSoapBody()
        {
            return $@"<copyMYPSData xmlns=""http://tempuri.org/"">
                        <Program_ID>{_pcmaData.ProgramId}</Program_ID>
                        <Project_ID>string</Project_ID>
                        <Projects{_pcmaData.MYPSUserName}</Projects>
                    </copyMYPSData>";
        }

        internal override async Task<PCMAResponse> ReadResponseContent(HttpContent responseContent)
        {
            var xml = await responseContent.ReadAsStringAsync();

            try
            {
                // Parse the SOAP response
                var doc = XDocument.Parse(xml);
                var ns = "https://www.dpwh.gov.ph/";

                var result = doc.Descendants(XName.Get("PublishPCMAResult", ns)).FirstOrDefault();
                
                if (result == null)
                {
                    return new PCMAResponse
                    {
                        Success = false,
                        Message = "Invalid response format",
                        ResponseData = xml
                    };
                }

                return new PCMAResponse
                {
                    Success = true,
                    Message = "PCMA published successfully",
                    ResponseData = result.Value ?? xml
                };
            }
            catch (Exception ex)
            {
                return new PCMAResponse
                {
                    Success = false,
                    Message = $"Error parsing response: {ex.Message}",
                    ResponseData = xml
                };
            }
        }
    }
}