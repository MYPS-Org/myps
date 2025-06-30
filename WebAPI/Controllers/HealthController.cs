using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        /// <summary>
        /// Health check endpoint
        /// </summary>
        /// <returns>Application status</returns>
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            return Ok(new { 
                status = "healthy", 
                timestamp = DateTime.UtcNow,
                application = "MyPS Backend API"
            });
        }
    }
}
