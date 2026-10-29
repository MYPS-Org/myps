using System.Security.Cryptography;

namespace Helpers
{
    /// <summary>
    /// Password hashes for <see cref="LocalLoginConfig"/>: PBKDF2 with SHA-256, stored as
    /// "PBKDF2-SHA256$iterations$salt$hash" (salt and hash in Base64). Settings hold only the hash.
    /// </summary>
    public static class LocalPassword
    {
        private const string Scheme = "PBKDF2-SHA256";
        private const int DefaultIterations = 600_000;
        private const int SaltBytes = 16;
        private const int HashBytes = 32;

        public static string Hash(string password, int iterations = DefaultIterations)
        {
            byte[] salt = RandomNumberGenerator.GetBytes(SaltBytes);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, HashBytes);
            return $"{Scheme}${iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        public static bool Verify(string? password, string? stored)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrWhiteSpace(stored)) return false;

            string[] parts = stored.Split('$');
            if (parts.Length != 4 || parts[0] != Scheme) return false;
            if (!int.TryParse(parts[1], out int iterations) || iterations < 1 || iterations > 10_000_000) return false;

            byte[] salt, expected;
            try
            {
                salt = Convert.FromBase64String(parts[2]);
                expected = Convert.FromBase64String(parts[3]);
            }
            catch (FormatException)
            {
                return false;
            }
            if (salt.Length == 0 || expected.Length == 0) return false;

            byte[] actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }

        /// <summary>True when LocalLogin lists <paramref name="userId"/> and the password matches its hash.</summary>
        public static bool Check(string userId, string? password)
            => Appsetting.LocalLogin.Users.TryGetValue(userId, out string? stored) && Verify(password, stored);
    }
}
