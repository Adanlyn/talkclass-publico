using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalkClass.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIdentificacaoFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "administradores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Email = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Cpf = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    SenhaHash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Roles = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_administradores", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categorias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: true),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Ativa = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categorias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "feedbacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CursoOuTurma = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NomeIdentificado = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ContatoIdentificado = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_feedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_feedbacks_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "perguntas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Enunciado = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    Obrigatoria = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Ordem = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Ativa = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_perguntas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_perguntas_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackRespostas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerguntaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    ValorNota = table.Column<int>(type: "integer", nullable: true),
                    ValorBool = table.Column<bool>(type: "boolean", nullable: true),
                    ValorOpcao = table.Column<string>(type: "text", nullable: true),
                    ValorTexto = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackRespostas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackRespostas_feedbacks_FeedbackId",
                        column: x => x.FeedbackId,
                        principalTable: "feedbacks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedbackRespostas_perguntas_PerguntaId",
                        column: x => x.PerguntaId,
                        principalTable: "perguntas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pergunta_opcoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PerguntaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Texto = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Valor = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pergunta_opcoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pergunta_opcoes_perguntas_PerguntaId",
                        column: x => x.PerguntaId,
                        principalTable: "perguntas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_administradores_Cpf",
                table: "administradores",
                column: "Cpf",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_administradores_IsActive",
                table: "administradores",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackRespostas_FeedbackId",
                table: "FeedbackRespostas",
                column: "FeedbackId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackRespostas_PerguntaId",
                table: "FeedbackRespostas",
                column: "PerguntaId");

            migrationBuilder.CreateIndex(
                name: "IX_feedbacks_CategoriaId",
                table: "feedbacks",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_pergunta_opcoes_PerguntaId",
                table: "pergunta_opcoes",
                column: "PerguntaId");

            migrationBuilder.CreateIndex(
                name: "IX_perguntas_CategoriaId_Ativa",
                table: "perguntas",
                columns: new[] { "CategoriaId", "Ativa" });

            migrationBuilder.CreateIndex(
                name: "IX_perguntas_Ordem",
                table: "perguntas",
                column: "Ordem");

            migrationBuilder.CreateIndex(
                name: "IX_perguntas_Tipo",
                table: "perguntas",
                column: "Tipo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "administradores");

            migrationBuilder.DropTable(
                name: "FeedbackRespostas");

            migrationBuilder.DropTable(
                name: "pergunta_opcoes");

            migrationBuilder.DropTable(
                name: "feedbacks");

            migrationBuilder.DropTable(
                name: "perguntas");

            migrationBuilder.DropTable(
                name: "Categorias");
        }
    }
}
