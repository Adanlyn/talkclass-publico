using System.Linq;
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using TalkClass.API.Endpoints;
using TalkClass.Application.Common.Interfaces;
using TalkClass.Infrastructure.Persistence;
using TalkClass.Application.Autenticacao.Dtos;
using TalkClass.Application.Autenticacao.Handlers;
using TalkClass.Infrastructure.Auth;
using System.Text.Json.Serialization;
using System.Text.Json;
using TalkClass.Infrastructure.Services.Email;
using TalkClass.API.Services;
using Microsoft.Extensions.Options;


var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

string? connStr =
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DEFAULTCONNECTION"]
    ?? builder.Configuration["ConnectionStrings__DefaultConnection"];

if (string.IsNullOrWhiteSpace(connStr))
    throw new InvalidOperationException("Connection string não encontrada.");

builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(connStr)

);
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

var allowedOriginsRaw = builder.Configuration["FrontendBaseUrl"] ?? "http://localhost:5174";
var allowedOrigins = allowedOriginsRaw
    .Split(',', StringSplitOptions.RemoveEmptyEntries)
    .Select(o => o.Trim().TrimEnd('/'))
    .ToArray();

builder.Services.AddCors(o =>
    o.AddDefaultPolicy(p =>
    {
        if (allowedOrigins.Length == 0)
            p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        else
            p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
    }));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var jwtIssuer   = builder.Configuration["Jwt:Issuer"]   ?? "talkclass.dev";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "talkclass.dev";
var jwtKey      = builder.Configuration["Jwt:Key"]      ?? throw new InvalidOperationException("Jwt:Key ausente");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();

// DI – validações e handlers usados nos endpoints de auth
builder.Services.AddValidatorsFromAssemblyContaining<LoginRequestDto>();
builder.Services.AddScoped<RealizarLoginHandler>();

builder.Services.AddSingleton<IPasswordHasher, PasswordHasherBcrypt>();

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<AlertsProcessor>();
builder.Services.AddScoped<AlertNotificationsRecorder>();

builder.Services.Configure<AiServiceOptions>(builder.Configuration.GetSection("AiService"));
builder.Services.AddHttpClient<AiClient>((sp, client) =>
{
    var opts = sp.GetRequiredService<IOptions<AiServiceOptions>>().Value;
    var baseUrl = string.IsNullOrWhiteSpace(opts.BaseUrl) ? "http://ai:8000" : opts.BaseUrl;
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
    if (opts.TimeoutSeconds > 0)
        client.Timeout = TimeSpan.FromSeconds(opts.TimeoutSeconds);
});

builder.Services.ConfigureHttpJsonOptions(opts =>
{
        opts.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;

    opts.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();
var api = app.MapGroup("/api");

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();   // POST /api/auth/login
app.MapUserEndpoints();   // GET  /api/user/me (protegido)
app.MapAdminUsersEndpoints();
app.MapFeedbackEndpoints();

app.MapCategoryEndpoints();


app.MapQuestionsEndpoints();
app.MapAlertEndpoints();
app.MapAdminNotificationsEndpoints();
app.MapReportsEndpoints();

api.MapDashboardEndpoints();

app.Run();
