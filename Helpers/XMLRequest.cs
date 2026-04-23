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
        private readonly Func<string> _customBodyProvider;
        
        /// <summary>
        /// Constructor for employee-based requests (backward compatibility)
        /// </summary>
        /// <param name="employeeId">The employee ID</param>
        public XMLRequest(string employeeId)
        {
            _employeeId = employeeId;
            _customBodyProvider = null;
        }
        
        /// <summary>
        /// Constructor for custom SOAP body requests
        /// </summary>
        /// <param name="customBodyProvider">Function that returns the custom SOAP body content</param>
        protected XMLRequest(Func<string> customBodyProvider)
        {
            _customBodyProvider = customBodyProvider ?? throw new ArgumentNullException(nameof(customBodyProvider));
            _employeeId = null;
        }
        
        internal abstract string RequestUri { get; }
        
        /// <summary>
        /// Override this method to provide custom SOAP body content.
        /// Default implementation returns employee-based body.
        /// </summary>
        protected virtual string GetSoapBody()
        {
            if (_customBodyProvider != null)
            {
                return _customBodyProvider();
            }
            
            return $@"<pis_get_employee xmlns=""http://tempuri.org/"">
                                <employee_id>{_employeeId}</employee_id>
                            </pis_get_employee>";
        }
        
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
                            {GetSoapBody()}
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
