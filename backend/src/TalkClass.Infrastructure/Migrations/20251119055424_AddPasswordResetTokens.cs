using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalkClass.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResetTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FeedbackRespostas_feedbacks_FeedbackId",
                table: "FeedbackRespostas");

            migrationBuilder.DropForeignKey(
                name: "FK_FeedbackRespostas_perguntas_PerguntaId",
                table: "FeedbackRespostas");

            migrationBuilder.DropForeignKey(
                name: "FK_feedbacks_Categorias_CategoriaId",
                table: "feedbacks");

            migrationBuilder.DropForeignKey(
                name: "FK_perguntas_Categorias_CategoriaId",
                table: "perguntas");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Categorias",
                table: "Categorias");

            migrationBuilder.DropPrimaryKey(
                name: "PK_FeedbackRespostas",
                table: "FeedbackRespostas");

            migrationBuilder.RenameTable(
                name: "Categorias",
                newName: "categorias");

            migrationBuilder.RenameTable(
                name: "FeedbackRespostas",
                newName: "feedback_respostas");

            migrationBuilder.RenameIndex(
                name: "IX_FeedbackRespostas_PerguntaId",
                table: "feedback_respostas",
                newName: "IX_feedback_respostas_PerguntaId");

            migrationBuilder.RenameIndex(
                name: "IX_FeedbackRespostas_FeedbackId",
                table: "feedback_respostas",
                newName: "IX_feedback_respostas_FeedbackId");

            migrationBuilder.AlterColumn<int>(
                name: "Ordem",
                table: "categorias",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<string>(
                name: "Nome",
                table: "categorias",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Descricao",
                table: "categorias",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "Ativa",
                table: "categorias",
                type: "boolean",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "administradores",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddPrimaryKey(
                name: "PK_categorias",
                table: "categorias",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_feedback_respostas",
                table: "feedback_respostas",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "password_reset_tokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdministradorId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_password_reset_tokens_administradores_AdministradorId",
                        column: x => x.AdministradorId,
                        principalTable: "administradores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_feedback_respostas_Tipo",
                table: "feedback_respostas",
                column: "Tipo");

            migrationBuilder.CreateIndex(
                name: "IX_password_reset_tokens_AdministradorId_ExpiresAt",
                table: "password_reset_tokens",
                columns: new[] { "AdministradorId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_password_reset_tokens_TokenHash",
                table: "password_reset_tokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_feedback_respostas_feedbacks_FeedbackId",
                table: "feedback_respostas",
                column: "FeedbackId",
                principalTable: "feedbacks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_feedback_respostas_perguntas_PerguntaId",
                table: "feedback_respostas",
                column: "PerguntaId",
                principalTable: "perguntas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_feedbacks_categorias_CategoriaId",
                table: "feedbacks",
                column: "CategoriaId",
                principalTable: "categorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_perguntas_categorias_CategoriaId",
                table: "perguntas",
                column: "CategoriaId",
                principalTable: "categorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_feedback_respostas_feedbacks_FeedbackId",
                table: "feedback_respostas");

            migrationBuilder.DropForeignKey(
                name: "FK_feedback_respostas_perguntas_PerguntaId",
                table: "feedback_respostas");

            migrationBuilder.DropForeignKey(
                name: "FK_feedbacks_categorias_CategoriaId",
                table: "feedbacks");

            migrationBuilder.DropForeignKey(
                name: "FK_perguntas_categorias_CategoriaId",
                table: "perguntas");

            migrationBuilder.DropTable(
                name: "password_reset_tokens");

            migrationBuilder.DropPrimaryKey(
                name: "PK_categorias",
                table: "categorias");

            migrationBuilder.DropPrimaryKey(
                name: "PK_feedback_respostas",
                table: "feedback_respostas");

            migrationBuilder.DropIndex(
                name: "IX_feedback_respostas_Tipo",
                table: "feedback_respostas");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "administradores");

            migrationBuilder.RenameTable(
                name: "categorias",
                newName: "Categorias");

            migrationBuilder.RenameTable(
                name: "feedback_respostas",
                newName: "FeedbackRespostas");

            migrationBuilder.RenameIndex(
                name: "IX_feedback_respostas_PerguntaId",
                table: "FeedbackRespostas",
                newName: "IX_FeedbackRespostas_PerguntaId");

            migrationBuilder.RenameIndex(
                name: "IX_feedback_respostas_FeedbackId",
                table: "FeedbackRespostas",
                newName: "IX_FeedbackRespostas_FeedbackId");

            migrationBuilder.AlterColumn<int>(
                name: "Ordem",
                table: "Categorias",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Nome",
                table: "Categorias",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120);

            migrationBuilder.AlterColumn<string>(
                name: "Descricao",
                table: "Categorias",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "Ativa",
                table: "Categorias",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Categorias",
                table: "Categorias",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_FeedbackRespostas",
                table: "FeedbackRespostas",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FeedbackRespostas_feedbacks_FeedbackId",
                table: "FeedbackRespostas",
                column: "FeedbackId",
                principalTable: "feedbacks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FeedbackRespostas_perguntas_PerguntaId",
                table: "FeedbackRespostas",
                column: "PerguntaId",
                principalTable: "perguntas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_feedbacks_Categorias_CategoriaId",
                table: "feedbacks",
                column: "CategoriaId",
                principalTable: "Categorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_perguntas_Categorias_CategoriaId",
                table: "perguntas",
                column: "CategoriaId",
                principalTable: "Categorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
