using System.ComponentModel.DataAnnotations;
using System.Runtime.Serialization;

namespace DBHelper.Models.Enums
{
    #region Stages
    public enum EnumProgramStage
    {
        BP = 1,
        NEP = 2,
        //[EnumMember(Value = "NEP-E")]
        NEPE = 3,	
        HGAB = 4,
        //[EnumMember(Value = "HGAB-I")]
        HGABI = 5,
        GAA = 6,
        //[EnumMember(Value = "GAA-R")]
        GAAR = 7,
        RBP = 8,	
        RDIP = 9,	
        PIP = 11,	
        TF = 12,
        //[EnumMember(Value = "TF-R")]
        TFR = 13,	
    }
    #endregion
    #region Type
    public enum EnumProgramType
    {
        RegularInfrastructure = 1,
        ExternalInfrastructure = 2,
        TrustFund = 3,
        AutomaticAppropriation = 4,
    }
    #endregion
    #region Status
    public enum EnumProgramStatus
    {
        //Proposed = 1,
        //Candidate = 2,
        Working = 3,
        Approved = 1
    }
    #endregion
}
