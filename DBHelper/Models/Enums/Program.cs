namespace DBHelper.Models.Enums
{
    #region Stages
    public enum EnumProgramStage
    {
        RBP = 8,
        BP = 1,
        NEP = 2,
        NEPE = 3,
        HGAB = 4,
        HGABI = 5,
        GAA = 6,
        GAAR = 7,
         
        RDIP = 9,
        UDIP = 10,
        PIP = 11,
        TF = 12,
        TFR = 13
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
