using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalkClass.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackIdToAlertNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FeedbackId",
                table: "alert_notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_alert_notifications_FeedbackId",
                table: "alert_notifications",
                column: "FeedbackId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_alert_notifications_FeedbackId",
                table: "alert_notifications");

            migrationBuilder.DropColumn(
                name: "FeedbackId",
                table: "alert_notifications");
        }
    }
}
