using DBHelper.Models.Table;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.MicroService
{
    public class RegistrationHub : Hub
    {
        public async Task SubscribeToOrder(string orderId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, orderId);
        }
    }
}
