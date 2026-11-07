#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
    Manages Cloudflare Anycast Quick Tunnels for Hotel Premium DevSecOps post-deployment verification.
.DESCRIPTION
    Exposes local Hotel Premium services (Frontend 5173, Kong API Gateway 8000, Keycloak IAM 8181)
    through ephemeral Cloudflare Quick Tunnels (*.trycloudflare.com), validates public edge
    reachability, persists state in scripts/.cloudflare-tunnels.json, and optionally synchronizes
    the public URLs with GitHub Actions repository variables.
.EXAMPLE
    .\scripts\manage-cloudflare-tunnels.ps1 -Action Start
.EXAMPLE
    .\scripts\manage-cloudflare-tunnels.ps1 -Action Status
.EXAMPLE
    .\scripts\manage-cloudflare-tunnels.ps1 -Action Stop
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("Start", "Stop", "Status", "Restart")]
    [string]$Action = "Start",

    [switch]$UpdateGitHub = $false,
    [string]$Repo = "GeorgeGxx/hotel_premium"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $scriptDir ".cloudflare-tunnels.json"
$logDir = Join-Path $scriptDir ".tunnel-logs"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Show-Header {
    param([string]$Title)
    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host " ☁️  HOTEL PREMIUM CLOUDFLARE QUICK TUNNELS" -ForegroundColor Cyan
    Write-Host " ▶ $Title" -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Cyan
}

function Stop-AllTunnels {
    param([bool]$DisableInGitHub = $false)
    Show-Header "Stopping Active Cloudflare Quick Tunnels"

    if (Test-Path $stateFile) {
        try {
            $state = Get-Content $stateFile -Raw | ConvertFrom-Json
            if ($state.processes) {
                foreach ($proc in $state.processes) {
                    if ($proc.pid) {
                        try {
                            $p = Get-Process -Id $proc.pid -ErrorAction SilentlyContinue
                            if ($p) {
                                Write-Host "  ▶ Stopping tunnel for $($proc.name) (PID $($proc.pid))..." -ForegroundColor White
                                Stop-Process -Id $proc.pid -Force -ErrorAction SilentlyContinue
                            }
                        } catch {}
                    }
                }
            }
        } catch {
            Write-Host "  [WARN] Could not parse tunnel state file: $_" -ForegroundColor Yellow
        }
        Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
    }

    $orphans = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($orphans) {
        Write-Host "  ▶ Cleaning up $($orphans.Count) cloudflared background process(es)..." -ForegroundColor DarkGray
        $orphans | Stop-Process -Force -ErrorAction SilentlyContinue
    }

    Write-Host "  [OK] All Cloudflare Quick Tunnels stopped cleanly." -ForegroundColor Green

    if ($DisableInGitHub -and (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Host "  ▶ Updating GitHub variable DEVSECOPS_POST_DEPLOY_ENABLED=false..." -ForegroundColor White
        try {
            & gh variable set DEVSECOPS_POST_DEPLOY_ENABLED --body "false" -R $Repo 2>$null
            Write-Host "  [OK] GitHub Actions post-deployment validation disabled." -ForegroundColor Green
        } catch {
            Write-Host "  [WARN] Could not update GitHub variable: $_" -ForegroundColor Yellow
        }
    }
}

function Get-TunnelStatus {
    Show-Header "Cloudflare Quick Tunnels Health & Edge Status"
    if (-not (Test-Path $stateFile)) {
        Write-Host "  [INFO] No active Cloudflare Quick Tunnels recorded in $stateFile." -ForegroundColor Yellow
        Write-Host "  [TIP]  Start tunnels with: .\platform-minikube.ps1 cloudflare -Action start" -ForegroundColor Cyan
        return
    }

    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    Write-Host "Started at: $($state.startedAt)" -ForegroundColor DarkGray

    $table = @()
    foreach ($item in $state.processes) {
        $p = Get-Process -Id $item.pid -ErrorAction SilentlyContinue
        $isRunning = ($null -ne $p)
        $httpStatus = "N/A"
        if ($isRunning -and $item.url) {
            try {
                $testPath = switch ($item.name) {
                    "frontend" { "/" }
                    "gateway"  { "/api/v1/rooms" }
                    "keycloak" { "/realms/master" }
                    default    { "/" }
                }
                $res = Invoke-WebRequest -Uri "$($item.url)$testPath" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
                $httpStatus = "HTTP $($res.StatusCode)"
            } catch {
                if ($_.Exception.Response) {
                    $httpStatus = "HTTP $($_.Exception.Response.StatusCode.value__)"
                } else {
                    $httpStatus = "Warming up / Unreachable"
                }
            }
        }

        $table += [pscustomobject]@{
            Service    = $item.name
            LocalPort  = $item.port
            PID        = $item.pid
            Status     = if ($isRunning) { "RUNNING" } else { "STOPPED" }
            EdgeHealth = $httpStatus
            PublicUrl  = $item.url
        }
    }

    $table | Format-Table -AutoSize
}

function Start-AllTunnels {
    Show-Header "Starting Cloudflare Quick Tunnels (Frontend, Kong Gateway, Keycloak)"

    $cfCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
    if (-not $cfCmd) {
        throw "cloudflared CLI was not found in PATH. Run '.\platform-minikube.ps1 tools -Install' or 'winget install Cloudflare.cloudflared'."
    }

    $targets = @(
        @{ Name = "frontend"; Port = 5173; HealthPath = "/";             Desc = "Hotel Premium React Frontend" },
        @{ Name = "gateway";  Port = 8000; HealthPath = "/api/v1/rooms"; Desc = "Kong API Gateway v3.9.4" },
        @{ Name = "keycloak"; Port = 8181; HealthPath = "/realms/master";Desc = "Keycloak IAM 26.8.1" }
    )

    Write-Host "Verifying local service ports before spawning edge tunnels..." -ForegroundColor Cyan
    foreach ($t in $targets) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $t.Port)
            $tcp.Close()
            Write-Host "  [OK] $($t.Desc) is listening on 127.0.0.1:$($t.Port)" -ForegroundColor Green
        } catch {
            Write-Host "  [WARN] Port $($t.Port) ($($t.Desc)) is not listening locally. Ensure '.\platform-minikube.ps1 tunnel' is active." -ForegroundColor Yellow
        }
    }

    Stop-AllTunnels -DisableInGitHub $false

    $activeProcesses = @()
    foreach ($t in $targets) {
        $logPath = Join-Path $logDir "tunnel-$($t.Name).log"
        $outPath = Join-Path $logDir "tunnel-$($t.Name).out"
        $errPath = Join-Path $logDir "tunnel-$($t.Name).err"
        foreach ($f in @($logPath, $outPath, $errPath)) {
            if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
        }

        Write-Host "  ▶ Spawning Cloudflare HTTP/2 tunnel for $($t.Desc) (http://127.0.0.1:$($t.Port))..." -ForegroundColor Cyan
        $argList = @(
            "tunnel",
            "--protocol", "http2",
            "--url", "http://127.0.0.1:$($t.Port)",
            "--logfile", $logPath,
            "--loglevel", "info",
            "--no-autoupdate"
        )
        $proc = Start-Process -FilePath $cfCmd.Source -ArgumentList $argList -PassThru -WindowStyle Hidden -RedirectStandardOutput $outPath -RedirectStandardError $errPath

        $activeProcesses += [ordered]@{
            name       = $t.Name
            desc       = $t.Desc
            port       = $t.Port
            healthPath = $t.HealthPath
            pid        = $proc.Id
            process    = $proc
            logPath    = $logPath
            url        = ""
        }
    }

    Write-Host "`nWaiting for Cloudflare Anycast Quick Tunnel URL assignment (up to 40s)..." -ForegroundColor Cyan
    $timeout = [DateTime]::UtcNow.AddSeconds(40)
    while ([DateTime]::UtcNow -lt $timeout) {
        $allFound = $true
        foreach ($item in $activeProcesses) {
            if (-not $item.url) {
                $allFound = $false
                $pathsToCheck = @($item.logPath, (Join-Path $logDir "tunnel-$($item.name).out"), (Join-Path $logDir "tunnel-$($item.name).err"))
                foreach ($p in $pathsToCheck) {
                    if (Test-Path $p) {
                        try {
                            $content = Get-Content $p -Raw -ErrorAction SilentlyContinue
                            if ($content -and $content -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
                                $item.url = $matches[0]
                                Write-Host "  [OK] $($item.desc) -> $($item.url)" -ForegroundColor Green
                                break
                            }
                        } catch {}
                    }
                }
            }
        }
        if ($allFound) { break }
        Start-Sleep -Milliseconds 400
    }

    $missing = @($activeProcesses | Where-Object { -not $_.url })
    if ($missing.Count -gt 0) {
        Write-Host "`n[WARN] Some tunnels did not obtain a trycloudflare.com URL within 40s:" -ForegroundColor Yellow
        foreach ($m in $missing) {
            Write-Host "  - $($m.name) (Inspect logs in: $logDir)" -ForegroundColor Yellow
        }
    }

    $stateData = [ordered]@{
        startedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        processes = @(
            foreach ($item in $activeProcesses) {
                [ordered]@{
                    name = $item.name
                    port = $item.port
                    pid  = $item.pid
                    url  = $item.url
                    log  = $item.logPath
                }
            }
        )
    }
    $stateData | ConvertTo-Json -Depth 5 | Set-Content -Path $stateFile -Encoding UTF8

    Write-Host "`nVerifying public edge reachability..." -ForegroundColor Cyan
    foreach ($item in $activeProcesses) {
        if (-not $item.url) { continue }
        $checkUrl = "$($item.url)$($item.healthPath)"
        $reachable = $false
        for ($attempt = 1; $attempt -le 4; $attempt++) {
            try {
                $res = Invoke-WebRequest -Uri $checkUrl -TimeoutSec 6 -UseBasicParsing -ErrorAction Stop
                if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
                    $reachable = $true
                    break
                }
            } catch {
                Start-Sleep -Seconds 2
            }
        }
        if ($reachable) {
            Write-Host "  [OK] Edge verified: $($item.name) -> $checkUrl" -ForegroundColor Green
        } else {
            Write-Host "  [INFO] Edge DNS propagating for $($item.name): $($item.url)" -ForegroundColor Yellow
        }
    }

    if ($UpdateGitHub -and (Get-Command gh -ErrorAction SilentlyContinue)) {
        $frontendUrl = ($activeProcesses | Where-Object { $_.name -eq "frontend" }).url
        $gatewayUrl  = ($activeProcesses | Where-Object { $_.name -eq "gateway" }).url
        $keycloakUrl = ($activeProcesses | Where-Object { $_.name -eq "keycloak" }).url
        Write-Host "`nSynchronizing URLs with GitHub Actions repository variables ($Repo)..." -ForegroundColor Cyan
        try {
            & gh variable set DEVSECOPS_POST_DEPLOY_ENABLED --body "true" -R $Repo 2>$null
            if ($gatewayUrl)  { & gh variable set DEVSECOPS_BASE_URL --body "$gatewayUrl" -R $Repo 2>$null }
            if ($frontendUrl) { & gh variable set DEVSECOPS_FRONTEND_URL --body "$frontendUrl" -R $Repo 2>$null }
            if ($keycloakUrl) { & gh variable set DEVSECOPS_KEYCLOAK_URL --body "$keycloakUrl" -R $Repo 2>$null }
            Write-Host "  [OK] GitHub Actions variables updated." -ForegroundColor Green
        } catch {
            Write-Host "  [WARN] Could not synchronize GitHub variables: $_" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Get-TunnelStatus
}

switch ($Action) {
    "Start"   { Start-AllTunnels }
    "Stop"    { Stop-AllTunnels -DisableInGitHub:$UpdateGitHub }
    "Status"  { Get-TunnelStatus }
    "Restart" {
        Stop-AllTunnels -DisableInGitHub $false
        Start-Sleep -Seconds 2
        Start-AllTunnels
    }
}
