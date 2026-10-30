using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Views
{
    public class Users
    {
        [Key]
        public int Id { get; set; }
        public int[] UserGroupIds { get; set; } = Array.Empty<int>();
        public string[] UserGroupNames { get; set; } = Array.Empty<string>();
        public bool ApplyFilter { get; set; } = false;
        // 2026-10-30, S04-TC028: no [Required] -- it turned every Edit/Delete of a user without an
        // Employee ID (344 of them, stored as '') into a 400. AddUser requires it itself.
        public string EmployeeId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        [Required]
        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? RegCode { get; set; } = string.Empty;
        public string? RegName { get; set; } = string.Empty;
        public string? PlantillaOffice { get; set; }
        public string? PlantillaOfficeName { get; set; }
        [Required]
        public bool IsActive { get; set; }
    }
}
