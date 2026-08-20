using DBHelper.Models.Table.User;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Hangfire.Hubs
{
    public class ReportHub : Hub
    {
        public async Task JoinJobGroup(string jobId)
            => await Groups.AddToGroupAsync(Context.ConnectionId, $"report-{jobId}");

        public async Task LeaveJobGroup(string jobId)
            => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"report-{jobId}");
    }
}