namespace DBHelper.Models.Enums
{
    #region Stages
    public enum EnumProgramStage
    {
        RDIP = 1,
        PIP = 2,
        RBP = 3,
        BP = 4,
        NEP = 5,
        NEPE = 6,
        HGAB = 7,
        HGABI = 8,
        GAA = 9,
        GAAR = 10,
        TF = 11,
        TFR = 12,
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
