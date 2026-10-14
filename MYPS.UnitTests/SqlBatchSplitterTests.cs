using Helpers;
using Xunit;

namespace MYPS.UnitTests;

public class SqlBatchSplitterTests
{
    [Fact]
    public void Split_OnGoLines_AnyCaseAndWhitespace()
    {
        var batches = SqlBatchSplitter.Split("SELECT 1;\nGO\nSELECT 2;\n  go  \nSELECT 3;\nGo\n");

        Assert.Equal(new[] { "SELECT 1;", "SELECT 2;", "SELECT 3;" }, batches.Select(b => b.Text));
        Assert.Equal(new[] { 1, 2, 3 }, batches.Select(b => b.Index));
    }

    [Fact]
    public void Split_NoTrailingGo_KeepsLastBatch()
    {
        var batches = SqlBatchSplitter.Split("SET QUOTED_IDENTIFIER ON;\r\nGO\r\nCREATE OR ALTER FUNCTION dbo.f() RETURNS INT AS BEGIN RETURN 1 END");

        Assert.Equal(2, batches.Count);
        Assert.StartsWith("CREATE OR ALTER FUNCTION", batches[1].Text);
        Assert.Equal(3, batches[1].StartLine);
    }

    [Fact]
    public void Split_GoWithCount_SetsRepeat()
    {
        var batches = SqlBatchSplitter.Split("INSERT t VALUES (1);\nGO 3\nSELECT 1;\nGO -- done\n");

        Assert.Equal(3, batches[0].Repeat);
        Assert.Equal(1, batches[1].Repeat);
        Assert.Equal(2, batches.Count);
    }

    [Fact]
    public void Split_GoInsideBlockComment_IsText()
    {
        var batches = SqlBatchSplitter.Split("/* header\nGO\n /* nested\nGO\n */ still comment\nGO\n*/\nSELECT 1;\nGO\nSELECT 2;");

        Assert.Equal(2, batches.Count);
        Assert.Contains("SELECT 1;", batches[0].Text);
        Assert.Contains("still comment", batches[0].Text);
        Assert.Equal("SELECT 2;", batches[1].Text);
    }

    [Fact]
    public void Split_GoInsideStringLiteral_IsText()
    {
        var batches = SqlBatchSplitter.Split("PRINT 'line one\nGO\nit''s still the string';\nGO\nSELECT 2;");

        Assert.Equal(2, batches.Count);
        Assert.Contains("it''s still the string", batches[0].Text);
    }

    [Fact]
    public void Split_LineCommentQuoteOrCommentOpener_DoesNotChangeState()
    {
        // An apostrophe or /* after -- must not open a string or comment.
        var batches = SqlBatchSplitter.Split("SELECT 1; -- don't /* care\nGO\nSELECT 2;");

        Assert.Equal(new[] { "SELECT 1; -- don't /* care", "SELECT 2;" }, batches.Select(b => b.Text));
    }

    [Fact]
    public void Split_GoAsPartOfAnIdentifier_IsNotASeparator()
    {
        var batches = SqlBatchSplitter.Split("SELECT 1 AS\nGOAL;\nGO\nSELECT 2;");

        Assert.Equal(2, batches.Count);
        Assert.Contains("GOAL;", batches[0].Text);
    }

    [Fact]
    public void Split_DropsEmptyBatches()
    {
        var batches = SqlBatchSplitter.Split("GO\n\nGO\nSELECT 1;\nGO\n   \nGO");

        Assert.Single(batches);
        Assert.Equal("SELECT 1;", batches[0].Text);
    }

    [Fact]
    public void Split_TheBranchObjectFiles_YieldsSetOptionsThenOneCreate()
    {
        // Mirrors the shape of every file under Resources/Internal/SQLObjects.
        const string file = "/* header with GO in prose\nGO\n*/\nSET QUOTED_IDENTIFIER ON;\nGO\nCREATE OR ALTER PROCEDURE dbo.p AS\nBEGIN\n    SELECT 'GO';\nEND\nGO\n";
        var batches = SqlBatchSplitter.Split(file);

        Assert.Equal(2, batches.Count);
        Assert.EndsWith("SET QUOTED_IDENTIFIER ON;", batches[0].Text);
        Assert.StartsWith("CREATE OR ALTER PROCEDURE", batches[1].Text);
    }
}
