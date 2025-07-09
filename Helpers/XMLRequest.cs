using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Helpers
{
    public abstract class XMLRequest<T>
    {
        private readonly string _employeeId;
        public XMLRequest(string employeeId)
        {
            _employeeId = employeeId;
        }
        internal abstract string RequestUri { get; }
        internal HttpRequestMessage ToHttpRequest()
        {
            var httpRequest = new HttpRequestMessage
            {
                RequestUri = new Uri(RequestUri),
                Method = HttpMethod.Post,
                Content = new StringContent(
                    $@"<soap:Envelope
                        xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance""
                        xmlns:xsd=""http://www.w3.org/2001/XMLSchema""
                        xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
                        <soap:Header>
                            <userName>{Appsetting.PIS.userName}</userName>
                            <password>{Appsetting.PIS.password}</password>
                        </soap:Header>
                        <soap:Body>
                            <pis_get_employee xmlns=""https://www.dpwh.gov.ph/"">
                                <employee_id>{_employeeId}</employee_id>
                            </pis_get_employee>
                        </soap:Body>
                    </soap:Envelope>",
                    Encoding.UTF8,
                    "application/xml")
            };
            httpRequest.Headers.Add("SOAPAction", "");
            return httpRequest;
        }
        internal abstract Task<T> ReadResponseContent(HttpContent responseContent);
    }
}
