using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalkClass.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alert_email_config",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminRecipientIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    ExtraEmails = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false, defaultValue: ""),
                    SendMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "immediate"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_email_config", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "alert_rules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    NotaMinima = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false),
                    PeriodoDias = table.Column<int>(type: "integer", nullable: false),
                    EnviarEmail = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Ativa = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_rules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_alert_rules_categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_alert_rules_Ativa",
                table: "alert_rules",
                column: "Ativa");

            migrationBuilder.CreateIndex(
                name: "IX_alert_rules_CategoriaId",
                table: "alert_rules",
                column: "CategoriaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_rules");

            migrationBuilder.DropTable(
                name: "alert_email_config");
        }
    }
}
