using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers
{
    public class CoreController : ControllerBase
    {
        public AppDbContext _db;
        public IHttpContextAccessor _httpContextAccessor;
        public CoreController(AppDbContext db, IHttpContextAccessor context)
        {
            _db = db;
            _httpContextAccessor = context;
        }
    }
}
