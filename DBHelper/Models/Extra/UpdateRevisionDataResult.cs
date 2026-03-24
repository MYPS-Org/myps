using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Extra
{
    public class UpdateRevisionDataResult<TDest>
    {
        public TDest Data { get; set; }
        public List<RevisionTransactionLog> RevisionTransaction { get; set; }
    }
}
