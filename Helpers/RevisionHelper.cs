using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Functions.Program;
using DBHelper.Models.Table.Lookups;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.ComponentModel.DataAnnotations;
using System.Data;
using static Helpers.ProjectHelper;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;

namespace Helpers
{
    public static class RevisionHelper
    {
        public class RevisionHelperResponse<T>
        {
            public bool IsValid { get; set; } = false;
            public string Title { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
            public T? Data { get; set; }
        }

        #region ValidateProjectId
        public class ValidateRevisionIdDataResult
        {
            public DBHelper.Models.Functions.Revision.RevisionProjectDetails ProjectDetails { get; set; } = new DBHelper.Models.Functions.Revision.RevisionProjectDetails();
            public DBHelper.Models.Table.Revision.RevisionDetails RevisionParent { get; set; } = new DBHelper.Models.Table.Revision.RevisionDetails();
            public DBHelper.Models.Functions.Revision.RevisionDetail RevisionDetail { get; set; } = new DBHelper.Models.Functions.Revision.RevisionDetail();
            public DBHelper.Models.Functions.Revision.RevisionApprovalStatus RevisionStatus { get; set; } = new DBHelper.Models.Functions.Revision.RevisionApprovalStatus();
        }
        public class ValidateRevisionParams
        {
            [Required]
            public string TransactionId { get; set; } = string.Empty;
            public DBHelper.Models.Views.Users _Session { get; set; } = new DBHelper.Models.Views.Users();
        }
        public static async Task<RevisionHelperResponse<ValidateRevisionIdDataResult>> ValidateTransactionId(this MYPSDbContext _db, ValidateRevisionParams p, CancellationToken cancellationToken)
        {
            var response = new RevisionHelperResponse<ValidateRevisionIdDataResult>();
            string TransactionId = p.TransactionId;
            var RevisionTransation = p.TransactionId.Split('-');
            string ProjectId = RevisionTransation[0];
            var Project = await _db.fRevisionProjectDetails
            .FromSqlInterpolated($"SELECT * FROM fRevisionProjectDetails({TransactionId})")
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
            if (Project == null)
            {
                response.Message = "Project not found or not in GAA-R stage.";
                response.Title = "Invalid Project";
                return response;
            }
            if (p._Session.ApplyFilter && Project.Region != p._Session.RegCode)
            {
                response.Message = "You don't have permission to view this project.";
                response.Title = "Permission Denied";
                return response;
            }
            string ProjectFK = Project.ProjectFK;
            var RevisionDetails = await _db.fRevisionDetail
                .FromSqlInterpolated($"SELECT * FROM fRevisionDetail({TransactionId})")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
            if (RevisionDetails == null)
            {
                response.Message = "Revision details not found.";
                response.Title = "Invalid Revision";
                return response;
            }
            var RevisionParent = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == p.TransactionId, cancellationToken);
            if (RevisionParent == null)
            {
                response.Message = "Revision details not found.";
                response.Title = "Invalid Revision";
                return response;
            }
            var ApprovalStatus = await _db.fRevisionApprovalStatus
                .FromSqlInterpolated($"SELECT * FROM fRevisionApprovalStatus({RevisionDetails.Id})")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
            if (ApprovalStatus == null)
            {
                response.Message = "Revision approval status not found.";
                response.Title = "Invalid Revision";
                return response;
            }

            response.IsValid = true;
            response.Data.ProjectDetails = Project;
            response.Data.RevisionParent = RevisionParent;
            response.Data.RevisionDetail = RevisionDetails;
            response.Data.RevisionStatus = ApprovalStatus;
            return response;
        }
        #endregion
    }
}
