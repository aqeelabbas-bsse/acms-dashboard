using AcmsDashboard.Api.Data;
using AcmsDashboard.Api.Middleware;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ---- Logging (Serilog) ----
builder.Host.UseSerilog((ctx, cfg) => cfg
    .MinimumLevel.Information()
    .WriteTo.Console());

// ---- Database (EF Core) ----
// Connection string comes from user-secrets in Development, environment
// variables in Production — never from a committed file.
builder.Services.AddDbContext<AcmsDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("AcmsDb")));

// ---- MVC / Swagger ----
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ---- CORS (permissive for local Angular dev; locked down in Phase 16) ----
builder.Services.AddCors(opt => opt.AddPolicy("AngularDev", p => p
    .WithOrigins("http://localhost:4200")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

// ---- Pipeline: order matters ----

// 1. Error handling FIRST, so it wraps everything after it.
app.UseMiddleware<ErrorHandlingMiddleware>();

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// 2. CORS BEFORE auth — otherwise a 401 reaches the browser without CORS
//    headers and shows up as a confusing CORS error instead of a 401.
app.UseCors("AngularDev");

// 3. Authentication/Authorization are added in Phase 3, once Identity + JWT
//    are configured. Calling them now would throw — services aren't registered.
// app.UseAuthentication();
// app.UseAuthorization();

app.MapControllers();

app.Run();

// Required so WebApplicationFactory<Program> can find this class in Phase 15.
public partial class Program { }