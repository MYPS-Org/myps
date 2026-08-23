using DBHelper.Models.API;
using Helpers;
using Helpers.API;

namespace WebAPI.Services.Revision
{
    public sealed class RevisionPcmaPublisher : IRevisionPcmaPublisher
    {
        public async Task<PCMAResponse> PublishRevisionAsync(
            string programId,
            string mypsUserName,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var pcmaData = new PublishPCMA
            {
                ProgramId = programId,
                MYPSUserName = mypsUserName
            };

            var request = new PCMA(pcmaData);
            PCMAResponse? response = await APIRequest.XML(request);

            cancellationToken.ThrowIfCancellationRequested();

            return response ?? new PCMAResponse
            {
                Success = false,
                Message = "PCMA publish returned no response."
            };
        }
    }
}
