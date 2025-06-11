using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers
{
    [AuthorizeSession]
    public abstract class CoreController : ControllerBase
    {
        public AppDbContext _db;
        public CoreController(AppDbContext db)
        {
            _db = db;
        }
    }
}
