//using Confluent.Kafka;
//using Microsoft.AspNetCore.SignalR;
//using Microsoft.Extensions.Hosting;
//using Newtonsoft.Json;
//using WebAPI.MicroService;

//public class OrderProcessorService : BackgroundService
//{
//    private readonly IHubContext<RegistrationHub> _hub;

//    public OrderProcessorService(IHubContext<RegistrationHub> hub)
//    {
//        _hub = hub;
//    }

//    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
//    {
//        var config = new ConsumerConfig
//        {
//            BootstrapServers = "localhost:9092",
//            GroupId = "order-processor",
//            AutoOffsetReset = AutoOffsetReset.Earliest
//        };

//        using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();
//        consumer.Subscribe("orders");

//        while (!stoppingToken.IsCancellationRequested)
//        {
//            try
//            {
//                var result = consumer.Consume(stoppingToken);
//                var order = JsonSerializer.Deserialize<OrderDto>(result.Message.Value);

//                // Simulate processing
//                await Task.Delay(3000, stoppingToken);

//                // Push update to frontend
//                await _hub.Clients.All.SendAsync("OrderStatusUpdated", new
//                {
//                    order?.Id,
//                    Status = "Processed"
//                });
//            }
//            catch (ConsumeException ex)
//            {
//                Console.WriteLine($"Kafka error: {ex.Error.Reason}");
//            }
//        }
//    }
//}
