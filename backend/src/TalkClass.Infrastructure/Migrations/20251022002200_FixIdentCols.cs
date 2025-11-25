using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TalkClass.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixIdentCols : Migration
    {
        /// <inheritdoc />
protected override void Up(MigrationBuilder m)
{
    m.AddColumn<string>(
        name: "NomeIdentificado",
        table: "feedbacks",
        type: "character varying(120)",
        maxLength: 120,
        nullable: true);

    m.AddColumn<string>(
        name: "ContatoIdentificado",
        table: "feedbacks",
        type: "character varying(160)",
        maxLength: 160,
        nullable: true);
}

protected override void Down(MigrationBuilder m)
{
    m.DropColumn(name: "NomeIdentificado", table: "feedbacks");
    m.DropColumn(name: "ContatoIdentificado", table: "feedbacks");
}


        /// <inheritdoc />
    }
}
