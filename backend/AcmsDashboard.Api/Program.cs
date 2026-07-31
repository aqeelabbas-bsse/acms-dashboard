using System.Text;
using System.Threading.RateLimiting;
using AcmsDashboard.Api.Analytics;
using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Identity;
using AcmsDashboard.Api.Jobs;
using AcmsDashboard.Api.Middleware;
using AcmsDashboard.Api.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Quartz;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) => cfg.MinimumLevel.Information().WriteTo.Console());

var connectionString = builder.Configuration.GetConnectionString("AcmsDb");

builder.Services.AddDbContext<AcmsDbContext>(opt => opt.UseSqlServer(connectionString));
builder.Services.AddDbContext<AppIdentityDbContext>(opt => opt.UseSqlServer(connectionString));
builder.Services.AddDbContext<AnalyticsDbContext>(opt => opt.UseSqlServer(connectionString));

builder.Services
    .AddIdentityCore<ApplicationUser>(opt =>
    {
        opt.Password.RequiredLength = 8;
        opt.Password.RequireDigit = true;
        opt.Password.RequireUppercase = true;
        opt.Password.RequireNonAlphanumeric = true;
        opt.User.RequireUniqueEmail = true;
        opt.Lockout.MaxFailedAccessAttempts = 5;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppIdentityDbContext>();

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret missing.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(opt =>
{
    opt.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.FromMinutes(1)
    };

    opt.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },

        OnChallenge = async context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code = "UNAUTHORIZED", message = "Missing or invalid token" }
            });
        },

        OnForbidden = async context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code = "FORBIDDEN", message = "Your role does not permit this action" }
            });
        }
    };
});

builder.Services.AddAuthorization();
builder.Services.AddScoped<TokenService>();

builder.Services.AddSignalR();
builder.Services.AddScoped<IAuditBroadcaster, AuditBroadcaster>();

builder.Services.AddScoped<EtlService>();

builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey(nameof(DailyStatsJob));

    q.AddJob<DailyStatsJob>(opt => opt.WithIdentity(jobKey));

    q.AddTrigger(opt => opt
        .ForJob(jobKey)
        .WithIdentity($"{nameof(DailyStatsJob)}-trigger")
        .StartAt(DateBuilder.FutureDate(15, IntervalUnit.Second))
        .WithSimpleSchedule(s => s.WithIntervalInHours(1).RepeatForever()));
});

builder.Services.AddQuartzHostedService(opt => opt.WaitForJobsToComplete = true);

// ---- NL Query Agent (Phase 7) ----
builder.Services.AddSingleton<SqlSafetyValidator>();
builder.Services.AddScoped<AgentService>();

builder.Services.AddHttpClient<GeminiClient>(client =>
{
    client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

// ---- Rate limiting (Phase 7) ----
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // 20/min per user on the agent - keeps us inside the Gemini free tier.
    options.AddPolicy("agent", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.User.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "anon",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));

    // 120/min everywhere else, per the API Specification.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            success = false,
            error = new { code = "RATE_LIMITED", message = "Too many requests. Please wait a moment." }
        }, ct);
    };
});

builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "ACMS Dashboard API",
        Version = "v1",
        Description = "Access Control Management System - NASTP"
    });

    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste your JWT here - do NOT include the word 'Bearer'."
    });

    opt.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", null),
            new List<string>()
        }
    });
});

builder.Services.AddCors(opt => opt.AddPolicy("AngularDev", p => p
    .WithOrigins("http://localhost:4200")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await IdentitySeeder.SeedAsync(scope.ServiceProvider, logger);
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AngularDev");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();   // AFTER auth - the limiter partitions by username

app.MapControllers();
app.MapHub<AuditHub>("/hubs/audit");

app.Run();

public partial class Program { }