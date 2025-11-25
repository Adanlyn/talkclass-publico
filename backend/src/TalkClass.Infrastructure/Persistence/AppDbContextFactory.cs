using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Npgsql.EntityFrameworkCore.PostgreSQL;


namespace TalkClass.Infrastructure.Persistence;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var basePath = Path.Combine(Directory.GetCurrentDirectory(), "..", "TalkClass.API");

        var cfg = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var cs = cfg.GetConnectionString("DefaultConnection")
                 ?? "Host=localhost;Port=5432;Database=talkclass;Username=postgres;Password=talkclass";

        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(cs)
            .Options;

        return new AppDbContext(opts);
    }
}
