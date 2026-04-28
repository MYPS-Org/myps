using System.Net.Http.Headers;
using System.Text;

namespace Helpers
{
    public abstract class XMLRequest<T>
    {
        /// <summary>The endpoint URI for this SOAP request.</summary>
        internal abstract string RequestUri { get; }

        /// <summary>
        /// The value of the <c>SOAPAction</c> HTTP header. Override to specify a custom action.
        /// Defaults to an empty string.
        /// </summary>
        protected virtual string SoapAction => string.Empty;

        /// <summary>
        /// Returns the inner content of the <c>&lt;soap:Body&gt;</c> element.
        /// Must be overridden by every concrete request class.
        /// </summary>
        protected abstract string GetSoapBody();

        /// <summary>
        /// Returns the inner content of the <c>&lt;soap:Header&gt;</c> element.
        /// Return <see langword="null"/> or an empty string to omit the header block entirely.
        /// Override to provide a custom SOAP header or to remove the default credentials header.
        /// </summary>
        protected virtual string GetSoapHeader()
            => $@"<UserDetails xmlns=""https://www.dpwh.gov.ph/"">
                        <userName>{Appsetting.PIS.userName}</userName>
                        <password>{Appsetting.PIS.password}</password>
                    </UserDetails>";

        /// <summary>
        /// Override to add or modify HTTP request headers beyond <c>SOAPAction</c>.
        /// </summary>
        /// <param name="headers">The <see cref="HttpRequestHeaders"/> of the outgoing request.</param>
        protected virtual void ConfigureHttpHeaders(HttpRequestHeaders headers) { }

        internal HttpRequestMessage ToHttpRequest()
        {
            var soapHeader = GetSoapHeader();
            var headerBlock = string.IsNullOrEmpty(soapHeader)
                ? string.Empty
                : $"<soap:Header>{soapHeader}</soap:Header>";

            var envelope = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope
    xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance""
    xmlns:xsd=""http://www.w3.org/2001/XMLSchema""
    xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
    {headerBlock}
    <soap:Body>
        {GetSoapBody()}
    </soap:Body>
</soap:Envelope>";

            var request = new HttpRequestMessage
            {
                RequestUri = new Uri(RequestUri),
                Method = HttpMethod.Post,
                Content = new StringContent(envelope, Encoding.UTF8, "text/xml")
            };

            request.Headers.Add("SOAPAction", SoapAction);
            ConfigureHttpHeaders(request.Headers);

            return request;
        }

        internal abstract Task<T> ReadResponseContent(HttpContent responseContent);
    }
}
