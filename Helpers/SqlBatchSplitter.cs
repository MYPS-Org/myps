using System.Text;
using System.Text.RegularExpressions;

namespace Helpers
{
    /// <summary>One batch of a script, as sqlcmd/SSMS would send it.</summary>
    /// <param name="Index">1-based position of the batch in the script.</param>
    /// <param name="StartLine">1-based line in the script where the batch's text begins.</param>
    /// <param name="Text">The batch text, without its GO line.</param>
    /// <param name="Repeat">The count from "GO n" (1 when the batch ends with a bare GO or the end of the script).</param>
    public sealed record SqlBatch(int Index, int StartLine, string Text, int Repeat);

    /// <summary>
    /// Splits a T-SQL script on its GO separators. GO is a sqlcmd/SSMS keyword, not T-SQL, so
    /// a script containing it cannot be sent to SQL Server as one command -- and CREATE
    /// FUNCTION/PROCEDURE/VIEW must be the first statement of its batch anyway.
    ///
    /// A line is a separator when, outside a block comment and a string literal, it reads
    /// "GO" or "GO n" (any case), optionally followed by a -- comment. GO inside /* */
    /// (nested comments are tracked, as SQL Server nests them), inside '...' or after -- on
    /// another line is text. Whitespace-only batches are dropped.
    /// </summary>
    public static class SqlBatchSplitter
    {
        private static readonly Regex GoLine = new(@"^\s*GO(?:\s+(?<count>\d+))?\s*(?:--.*)?$",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        public static IReadOnlyList<SqlBatch> Split(string script)
        {
            var batches = new List<SqlBatch>();
            var current = new StringBuilder();
            int commentDepth = 0;
            bool inString = false;
            int batchStartLine = 1;

            string[] lines = script.Replace("\r\n", "\n").Split('\n');
            for (int i = 0; i < lines.Length; i++)
            {
                string line = lines[i];
                int lineNumber = i + 1;

                if (commentDepth == 0 && !inString)
                {
                    Match go = GoLine.Match(line);
                    if (go.Success)
                    {
                        int repeat = go.Groups["count"].Success ? int.Parse(go.Groups["count"].Value) : 1;
                        Add(batches, current, batchStartLine, repeat);
                        current.Clear();
                        batchStartLine = lineNumber + 1;
                        continue;
                    }
                }

                Scan(line, ref commentDepth, ref inString);
                current.Append(line).Append('\n');
            }

            Add(batches, current, batchStartLine, 1);
            return batches;
        }

        /// <summary>Advances the comment/string state across one line.</summary>
        private static void Scan(string line, ref int commentDepth, ref bool inString)
        {
            for (int c = 0; c < line.Length; c++)
            {
                char ch = line[c];
                char next = c + 1 < line.Length ? line[c + 1] : '\0';

                if (inString)
                {
                    if (ch == '\'')
                    {
                        if (next == '\'') c++;      // '' is an escaped quote
                        else inString = false;
                    }
                }
                else if (commentDepth > 0)
                {
                    if (ch == '/' && next == '*') { commentDepth++; c++; }
                    else if (ch == '*' && next == '/') { commentDepth--; c++; }
                }
                else if (ch == '-' && next == '-')
                {
                    return;                         // rest of the line is a comment
                }
                else if (ch == '/' && next == '*') { commentDepth = 1; c++; }
                else if (ch == '\'') inString = true;
            }
        }

        private static void Add(List<SqlBatch> batches, StringBuilder text, int startLine, int repeat)
        {
            string batch = text.ToString();
            if (string.IsNullOrWhiteSpace(batch)) return;

            // Report the line the batch's first non-blank text is on, not the blank lines before it.
            int leading = 0;
            foreach (string line in batch.Split('\n'))
            {
                if (!string.IsNullOrWhiteSpace(line)) break;
                leading++;
            }
            batches.Add(new SqlBatch(batches.Count + 1, startLine + leading, batch.TrimEnd(), repeat));
        }
    }
}
