using DBHelper.Models.API;

namespace WebAPI.Services.Revision
{
    public interface IRevisionPcmaPublisher
    {
        Task<PCMAResponse> PublishRevisionAsync(
            string programId,
            string mypsUserName,
            CancellationToken cancellationToken);
    }
}
