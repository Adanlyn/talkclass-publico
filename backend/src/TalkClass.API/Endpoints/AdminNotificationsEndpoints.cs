using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TalkClass.Infrastructure.Persistence;

namespace TalkClass.API.Endpoints;

public static class AdminNotificationsEndpoints
{
    public static IEndpointRouteBuilder MapAdminNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin-notifications")
            .RequireAuthorization()
            .WithTags("AdminNotifications");

        group.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var items = await db.AlertNotifications
                .AsNoTracking()
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .Select(n => new
                {
                    id = n.Id,
                    title = n.Title,
                    message = n.Message,
                    severity = n.Severity,
                    feedbackId = n.FeedbackId,
                    read = n.Read,
                    createdAt = n.CreatedAt
                })
                .ToListAsync(ct);

            return Results.Ok(items);
        });

        group.MapPatch("/{id:guid}/read", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var item = await db.AlertNotifications.FirstOrDefaultAsync(n => n.Id == id, ct);
            if (item is null) return Results.NotFound();
            if (!item.Read)
            {
                item.Read = true;
                await db.SaveChangesAsync(ct);
            }
            return Results.NoContent();
        });

        group.MapPost("/read-all", async (AppDbContext db, CancellationToken ct) =>
        {
            await db.AlertNotifications
                .Where(n => !n.Read)
                .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.Read, true), ct);
            return Results.NoContent();
        });

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var deleted = await db.AlertNotifications.Where(n => n.Id == id).ExecuteDeleteAsync(ct);
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        });

        return app;
    }
}
