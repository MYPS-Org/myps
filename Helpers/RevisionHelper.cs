using DBHelper.Data;
using DBHelper.Models.Functions.Revision;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using static Helpers.RevisionHelper;


namespace Helpers
{
    public static class RevisionHelper
    {
        public class RevisionHelperResponse<T>
        {
            public bool IsValid { get; set; } = false;
            public string Title { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
            public T? Data { get; set; } = default;
        }

        #region ValidateProjectId
        public class ValidateRevisionIdDataResult
        {
            public RevisionProjectDetails ProjectDetails { get; set; } = new RevisionProjectDetails();
            public DBHelper.Models.Table.Revision.RevisionDetails RevisionParent { get; set; } = new DBHelper.Models.Table.Revision.RevisionDetails();
            public RevisionDetail RevisionDetail { get; set; } = new RevisionDetail();
            public RevisionApprovalStatus RevisionStatus { get; set; } = new RevisionApprovalStatus();
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
            response.Data = new ValidateRevisionIdDataResult()
            {
                ProjectDetails = Project,
                RevisionParent = RevisionParent,
                RevisionDetail = RevisionDetails,
                RevisionStatus = ApprovalStatus
            };
            return response;
        }
        #endregion
        #region Create Action Rules
        public class RevisionActionRules
        {
            public bool CanApprove { get; set; }
            public bool CanForCorrection { get; set; }
            public bool CanSubmit { get; set; }
        }

        public class CreateActionRulesParam
        {
            public RevisionApprovalStatus ApprovalStatus { get; set; } = new();
            public string[] UserGroupNames { get; set; } = Array.Empty<string>();
        }

        public static RevisionHelperResponse<RevisionActionRules> CreateActionRules(this CreateActionRulesParam p)
        {
            var response = new RevisionHelperResponse<RevisionActionRules>
            {
                IsValid = true,
                Data = new RevisionActionRules()
            };

            var groups = p.UserGroupNames ?? Array.Empty<string>();

            bool isROUser = groups.Contains(
                "RPC",
                StringComparer.OrdinalIgnoreCase);

            bool isCOUser = groups.Contains(
                "AUC",
                StringComparer.OrdinalIgnoreCase);

            bool isIOUser =
                !isROUser &&
                !isCOUser;

            var status = p.ApprovalStatus;

            // ============================================================
            // RO
            //
            // RO can act only when the revision is waiting for RO approval.
            //
            // 0 = ForApproval
            // ============================================================

            bool canROAct =
                isROUser &&
                status.ROStatus == 0;


            // ============================================================
            // CO
            //
            // CO can act only after RO has approved
            // and CO has not acted yet.
            //
            // RO = 1 -> Approved
            // CO = 0 -> ForApproval
            // ============================================================

            bool canCOAct =
                isCOUser &&
                status.ROStatus == 1 &&
                status.COStatus == 0;


            // ============================================================
            // IO
            //
            // IO can resubmit only when either approval level
            // returned the revision for correction.
            //
            // 3 = ForCorrection
            //
            // After resubmission, both statuses should be reset to 0
            // because the corrected revision must go through RO again.
            // ============================================================

            bool canSubmit =
                isIOUser &&
                (
                    status.ROStatus == 3 ||
                    status.COStatus == 3
                );


            response.Data = new RevisionActionRules
            {
                CanApprove =
                    canROAct ||
                    canCOAct,

                CanForCorrection =
                    canROAct ||
                    canCOAct,

                CanSubmit =
                    canSubmit
            };

            return response;
        }
        #endregion
    }
}
