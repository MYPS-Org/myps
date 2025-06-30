using DBHelper.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TestController : CoreController
    {
        public TestController(AppDbContext db) : base(db)
        {
        }

        /// <summary>
        /// Test endpoint to verify API is working
        /// </summary>
        /// <returns>A simple test message</returns>
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            return Ok(new { message = "API is working!", timestamp = DateTime.Now });
        }

        /// <summary>
        /// Test endpoint with parameter
        /// </summary>
        /// <param name="id">Test ID parameter</param>
        /// <returns>Echo of the ID parameter</returns>
        [HttpGet("{id}")]
        [AllowAnonymous]
        public IActionResult GetById(int id)
        {
            return Ok(new { id = id, message = "ID received successfully" });
        }

        /// <summary>
        /// Test POST endpoint
        /// </summary>
        /// <param name="data">Test data object</param>
        /// <returns>Echo of the posted data</returns>
        [HttpPost]
        [AllowAnonymous]
        public IActionResult Post([FromBody] object data)
        {
            return Ok(new { received = data, timestamp = DateTime.Now });
        }
    }
}
