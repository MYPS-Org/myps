using DBHelper.Models.Enums;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Lumpsum
{
    #region Wallet list

    public class ShowLumpsumDTO : EnumPagination<ShowLumpsumFilterDTO> { }

    public class ShowLumpsumFilterDTO
    {
        /// <summary>Program natural key (tPrograms.ProgramPK).</summary>
        [MaxLength(200)]
        public string? ProgramFK { get; set; }
        /// <summary>Free-text match on the program's display name.</summary>
        [MaxLength(200)]
        public string? ProgramName { get; set; }
        /// <summary>Wallet lifecycle stage: BP / NEP / HGAB / GAA / GAA-R.</summary>
        [MaxLength(20)]
        public string? CurrentStage { get; set; }
        [MaxLength(20)]
        public string? OperatingUnit { get; set; }
        public int? CategoryId { get; set; }
        public int? YearStart { get; set; }
    }

    #endregion

    #region Wallet detail / balance

    // [Required] on a non-nullable int is a no-op — 0 satisfies it — so an
    // omitted or default WalletId used to fall through to the lookup and come
    // back as the misleading "Wallet not found." Range makes the distinction
    // explicit: 0/negative is a bad request, a positive id that isn't there is
    // genuinely missing.
    public class LumpsumDetailsDTO
    {
        /// <summary>Id of the LS Wallet. Sample value only — wallet Ids are
        /// IDENTITY values, so run SELECT Id FROM vLSWalletLatest for real ones.</summary>
        [Range(1, int.MaxValue, ErrorMessage = "WalletId is required and must be greater than 0.")]
        [DefaultValue(10)]
        public int WalletId { get; set; }
    }

    public class WalletBalanceDTO
    {
        /// <summary>Id of the LS Wallet. Sample value only — wallet Ids are
        /// IDENTITY values, so run SELECT Id FROM vLSWalletLatest for real ones.</summary>
        [Range(1, int.MaxValue, ErrorMessage = "WalletId is required and must be greater than 0.")]
        [DefaultValue(10)]
        public int WalletId { get; set; }
    }

    #endregion

    #region Itemized projects

    public class ShowItemizedProjectsDTO : EnumPagination<ShowItemizedProjectsFilterDTO> { }

    public class ShowItemizedProjectsFilterDTO
    {
        /// <summary>Id of the LS Wallet. Sample value only — wallet Ids are
        /// IDENTITY values, so run SELECT Id FROM vLSWalletLatest for real ones.</summary>
        [Range(1, int.MaxValue, ErrorMessage = "WalletId is required and must be greater than 0.")]
        [DefaultValue(10)]
        public int WalletId { get; set; }
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        /// <summary>Null = both; true = published only; false = unpublished only.</summary>
        public bool? IsPublished { get; set; }
    }

    #endregion
}
