using DBHelper.Models.Table;
using Newtonsoft.Json;
using Xunit;

namespace MYPS.UnitTests;

public sealed class RevisionModificationRulesTests
{
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Feature", "FormalRevision")]
    public void ModificationRules_UsesNormalizedRevisionRuleFieldNames()
    {
        const string ruleJson = """
        {
          "ComponentCostYearRules": {
            "Fields": {
              "UACS": true,
              "Year": true,
              "Amount": false,
              "StartDate": false,
              "EndDate": false
            }
          },
          "FundingProfileRules": {
            "Fields": {
              "SourceOrg": true,
              "AgreementCode": true,
              "Amount": false,
              "Percentage": false
            }
          },
          "MajorItemOfWorkRules": {
            "Fields": {
              "ComponentId": false,
              "YearOfWork": false,
              "WorkTypeFK": true,
              "InfraTypeFK": true
            }
          }
        }
        """;

        var rules = JsonConvert.DeserializeObject<ModificationRules>(ruleJson);

        Assert.NotNull(rules);
        Assert.True(rules!.ComponentCostYearRules.Fields.UACS);
        Assert.True(rules.FundingProfileRules.Fields.SourceOrg);
        Assert.True(rules.FundingProfileRules.Fields.AgreementCode);
        Assert.True(rules.MajorItemOfWorkRules.Fields.WorkTypeFK);
        Assert.True(rules.MajorItemOfWorkRules.Fields.InfraTypeFK);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Feature", "FormalRevision")]
    public void ProjectDetailsRules_DoesNotExposeDeadUacsFlag()
    {
        Assert.Null(typeof(RuleProjectDetails).GetProperty("UACS"));
    }
}
