using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalkClass.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAlertNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alert_notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Message = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "info"),
                    Read = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_notifications", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_alert_notifications_CreatedAt",
                table: "alert_notifications",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_alert_notifications_Read",
                table: "alert_notifications",
                column: "Read");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_notifications");
        }
    }
}
