using System.Linq;
using System.Security.Claims;
using TalkClass.Domain.Security;

namespace TalkClass.API.Endpoints;

public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/user").RequireAuthorization();

        g.MapGet("/me", (ClaimsPrincipal user) =>
        {
            var roles = user.FindAll(ClaimTypes.Role).Select(c => c.Value).Distinct().ToArray();
            var primaryRole = roles.FirstOrDefault() ?? AdminRoles.Admin;
            var mustChange = bool.TryParse(user.FindFirst("must_change_password")?.Value, out var flag) && flag;

            return Results.Ok(new
            {
                Id = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value,
                Nome = user.FindFirst(ClaimTypes.Name)?.Value,
                Email = user.FindFirst(ClaimTypes.Email)?.Value,
                Cpf = user.FindFirst("cpf")?.Value,
                Role = primaryRole,
                Roles = roles,
                MustChangePassword = mustChange
            });
        });

        return app;
    }
}
