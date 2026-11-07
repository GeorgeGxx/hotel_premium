<#
.SYNOPSIS
    Native PowerShell script to bootstrap Keycloak realm, clients, roles and test users.
.DESCRIPTION
    Interacts directly with Keycloak REST API (port 8181) to ensure the realm, confidential client,
    public frontend client, and test users (admin_user, basic_user) are configured and ready.
    Includes automated token refresh and re-authentication on 401 Unauthorized.
.EXAMPLE
    .\scripts\bootstrap-keycloak.ps1
#>

[CmdletBinding()]
param (
    [string]$KeycloakUrl = "http://localhost:8181",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "admin",
    [string]$Realm = "hotel-realm",
    [string]$RealmExportPath = ""
)

$ErrorActionPreference = "Stop"

# Auto-resolve default realm-export.json path if not explicitly provided
if (-not $RealmExportPath) {
    $candidates = @(
        (Join-Path $PSScriptRoot "..\keycloak\hotel-realm-realm.json")
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $RealmExportPath = (Resolve-Path $cand).Path
            break
        }
    }
}

# Auto-load defaults from .env if available
$envCandidates = @(
    (Join-Path $PSScriptRoot "..\..\.env"),
    (Join-Path $PSScriptRoot "..\.env"),
    (Join-Path (Get-Location) ".env")
)
$envPath = $envCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($envPath) {
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and ($line -match "^([^=]+)=(.*)$")) {
            $k = $matches[1].Trim()
            $v = $matches[2].Trim()
            if ($k -eq "KEYCLOAK_ADMIN" -and $AdminUser -eq "admin") { $AdminUser = $v }
            if ($k -eq "KEYCLOAK_ADMIN_PASSWORD" -and $AdminPassword -eq "admin") { $AdminPassword = $v }
            if ($k -eq "KEYCLOAK_PORT" -and $KeycloakUrl -eq "http://localhost:8181") { $KeycloakUrl = "http://localhost:$v" }
        }
    }
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  KEYCLOAK REALM AND USERS BOOTSTRAPPER               " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  URL:   $KeycloakUrl"
Write-Host "  Realm: $Realm"
Write-Host "=======================================================`n"

# 1. Wait for Keycloak readiness
Write-Host "[1/5] Checking Keycloak accessibility on $KeycloakUrl..." -ForegroundColor Yellow
$deadline = (Get-Date).AddSeconds(150)
$ready = $false
$elapsed = 0
while ((Get-Date) -lt $deadline) {
    try {
        $check = Invoke-WebRequest -Uri "$KeycloakUrl/realms/master" -Method GET -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($check -and ($check.StatusCode -in 200, 302, 401)) {
            $ready = $true
            break
        }
    } catch {
        # Waiting for port-forward or Keycloak internal startup
    }
    if ($elapsed -ge 6 -and $KeycloakUrl -match "localhost:8181") {
        # Auto-launch dedicated port-forward to Keycloak if no process is already forwarding 8181
        Start-Process -FilePath "kubectl" -ArgumentList "port-forward -n auth svc/keycloak 8181:8181" -WindowStyle Hidden -ErrorAction SilentlyContinue
    }
    Write-Host "  ... waiting for Keycloak to respond ($elapsed s elapsed)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
    $elapsed += 3
}

if (-not $ready) {
    Write-Host "[X] Keycloak is not reachable on $KeycloakUrl after 150s. Ensure Keycloak is running." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Keycloak is ready." -ForegroundColor Green

# 2. Token Management & API Wrapper
$script:AdminToken = $null
$script:AdminTokenExpiresAt = [DateTime]::MinValue

function Get-AdminHeaders {
    param([switch]$ForceRefresh)
    $now = [DateTime]::UtcNow
    if ($ForceRefresh -or [string]::IsNullOrEmpty($script:AdminToken) -or $now -ge $script:AdminTokenExpiresAt) {
        $tokenBody = @{
            client_id = "admin-cli"
            grant_type = "password"
            username = $AdminUser
            password = $AdminPassword
        }
        $tokenResp = Invoke-RestMethod -Method Post -Uri "$KeycloakUrl/realms/master/protocol/openid-connect/token" -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
        $script:AdminToken = $tokenResp.access_token
        $lifespan = if ($tokenResp.expires_in) { [int]$tokenResp.expires_in } else { 60 }
        # Proactively refresh when token has less than 20 seconds remaining
        $script:AdminTokenExpiresAt = $now.AddSeconds([math]::Max(10, $lifespan - 20))
    }
    return @{
        Authorization = "Bearer $($script:AdminToken)"
        "Content-Type" = "application/json"
    }
}

function Invoke-KeycloakAdmin {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $false)]$Body = $null
    )

    $hdrs = Get-AdminHeaders
    $action = if ($PSBoundParameters.ContainsKey('ErrorAction')) { $PSBoundParameters['ErrorAction'] } else { "Stop" }
    $callParams = @{
        Method = $Method
        Uri = $Uri
        Headers = $hdrs
        ErrorAction = $action
    }
    if ($null -ne $Body) {
        $callParams["ContentType"] = "application/json"
        if ($Body -is [string]) {
            $callParams["Body"] = $Body
        } else {
            $callParams["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
        }
    }

    try {
        return Invoke-RestMethod @callParams
    } catch {
        $is401 = $false
        if ($_.Exception -and $_.Exception.Response) {
            try {
                if ($_.Exception.Response.StatusCode.value__ -eq 401) { $is401 = $true }
            } catch {}
        }
        if (-not $is401 -and ("$_" -match "401" -or "$_" -match "Unauthorized")) {
            $is401 = $true
        }

        if ($is401) {
            $callParams["Headers"] = Get-AdminHeaders -ForceRefresh
            return Invoke-RestMethod @callParams
        }
        throw $_
    }
}

$headers = Get-AdminHeaders
Write-Host "[OK] Admin token acquired." -ForegroundColor Green

# 3. Ensure Realm & Disable Profile Prompt Actions
Write-Host "`n[3/5] Checking / Creating Realm '$Realm'..." -ForegroundColor Yellow
$realmExists = $false
try {
    $existingRealm = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm" -ErrorAction Stop
    if ($existingRealm -and $existingRealm.realm -eq $Realm) {
        $realmExists = $true
    }
} catch {
    $realmExists = $false
}

if (-not $realmExists) {
    if ($RealmExportPath -and (Test-Path $RealmExportPath)) {
        Write-Host "  Importing declarative realm definition from: $RealmExportPath" -ForegroundColor Cyan
        try {
            $rawJson = Get-Content -Path $RealmExportPath -Raw -Encoding UTF8
            Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms" -Body $rawJson
            Write-Host "[OK] Realm '$Realm' imported from export file successfully." -ForegroundColor Green
        } catch {
            Write-Host "  [!] Warning: Import from $RealmExportPath failed ($($_.Exception.Message)). Creating default realm..." -ForegroundColor Yellow
            $realmPayload = @{
                id = $Realm
                realm = $Realm
                enabled = $true
                verifyEmail = $false
                resetPasswordAllowed = $true
                registrationAllowed = $true
                loginWithEmailAllowed = $true
            } | ConvertTo-Json
            Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms" -Body $realmPayload
            Write-Host "[OK] Default Realm '$Realm' created successfully." -ForegroundColor Green
        }
    } else {
        $realmPayload = @{
            id = $Realm
            realm = $Realm
            enabled = $true
            verifyEmail = $false
            resetPasswordAllowed = $true
            registrationAllowed = $true
            loginWithEmailAllowed = $true
        } | ConvertTo-Json
        Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms" -Body $realmPayload
        Write-Host "[OK] Realm '$Realm' created successfully." -ForegroundColor Green
    }
} else {
    try {
        $updatePayload = @{
            verifyEmail = $false
            resetPasswordAllowed = $true
            registrationAllowed = $true
            loginWithEmailAllowed = $true
        } | ConvertTo-Json
        Invoke-KeycloakAdmin -Method Put -Uri "$KeycloakUrl/admin/realms/$Realm" -Body $updatePayload
        Write-Host "  Realm '$Realm' updated with non-blocking profile policy and user registration enabled." -ForegroundColor DarkGray
    } catch {
        Write-Host "  Realm '$Realm' already exists." -ForegroundColor Green
    }
}

# Clear default required actions (like UPDATE_PROFILE or VERIFY_EMAIL) on realm level
try {
    $reqActions = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/authentication/required-actions"
    foreach ($ra in $reqActions) {
        if ($ra.defaultAction) {
            $ra.defaultAction = $false
            Invoke-KeycloakAdmin -Method Put -Uri "$KeycloakUrl/admin/realms/$Realm/authentication/required-actions/$($ra.alias)" -Body ($ra | ConvertTo-Json)
        }
    }
} catch {}

# 4. Ensure Clients
Write-Host "`n[4/5] Configuring Clients..." -ForegroundColor Yellow
# Frontend Public Client
$clients = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/clients?clientId=hotel-frontend"
if (-not $clients -or $clients.Count -eq 0) {
    $frontendClient = @{
        clientId = "hotel-frontend"
        enabled = $true
        publicClient = $true
        redirectUris = @("*", "http://localhost:*", "http://127.0.0.1:*", "http://192.168.49.2:*")
        webOrigins = @("*", "+")
        protocol = "openid-connect"
        standardFlowEnabled = $true
        directAccessGrantsEnabled = $true
    } | ConvertTo-Json
    Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/clients" -Body $frontendClient
    Write-Host "  [OK] Created public client: hotel-frontend" -ForegroundColor Green
} else {
    $fcId = $clients[0].id
    $frontendClient = @{
        clientId = "hotel-frontend"
        enabled = $true
        publicClient = $true
        redirectUris = @("*", "http://localhost:*", "http://127.0.0.1:*", "http://192.168.49.2:*")
        webOrigins = @("*", "+")
        protocol = "openid-connect"
        standardFlowEnabled = $true
        directAccessGrantsEnabled = $true
    } | ConvertTo-Json
    Invoke-KeycloakAdmin -Method Put -Uri "$KeycloakUrl/admin/realms/$Realm/clients/$fcId" -Body $frontendClient
    Write-Host "  [OK] Public client hotel-frontend updated with flexible origins and redirect URIs." -ForegroundColor DarkGray
}

# Backend Confidential Client
$clients = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/clients?clientId=hotel-backend"
$confClientId = $null
if (-not $clients -or $clients.Count -eq 0) {
    $confClient = @{
        clientId = "hotel-backend"
        enabled = $true
        publicClient = $false
        redirectUris = @("http://localhost:8080/*", "https://oauth.pstmn.io/v1/browser-callback")
        protocol = "openid-connect"
        standardFlowEnabled = $true
        directAccessGrantsEnabled = $true
    } | ConvertTo-Json
    Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/clients" -Body $confClient
    $clients = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/clients?clientId=hotel-backend"
    $confClientId = $clients[0].id
    Write-Host "  [OK] Created confidential client: hotel-backend" -ForegroundColor Green
} else {
    $confClientId = $clients[0].id
    Write-Host "  Confidential client hotel-backend already exists." -ForegroundColor DarkGray
}

# Generate/Fetch Client Secret and Sync to .env and K8s Secret
try {
    $secret = $null
    try {
        $existingSec = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/clients/$confClientId/client-secret" -ErrorAction SilentlyContinue
        if ($existingSec.value) {
            $secret = $existingSec.value
        }
    } catch {}

    if (-not $secret) {
        $secretObj = Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/clients/$confClientId/client-secret"
        $secret = $secretObj.value
    }

    if ($secret) {
        Write-Host "  [OK] Active Client Secret: $secret" -ForegroundColor Green
        
        # Update .env in project root
        if (Test-Path $envPath) {
            $envLines = Get-Content $envPath
            $newLines = @()
            $found = $false
            foreach ($line in $envLines) {
                if ($line -like "KEYCLOAK_CLIENT_SECRET=*") {
                    $newLines += "KEYCLOAK_CLIENT_SECRET=$secret"
                    $found = $true
                } else {
                    $newLines += $line
                }
            }
            if (-not $found) { $newLines += "KEYCLOAK_CLIENT_SECRET=$secret" }
            $newLines | Set-Content $envPath -Encoding UTF8
            Write-Host "  [OK] Sourced client secret into .env" -ForegroundColor Green
        }

        # Update Kubernetes Secret if cluster is reachable
        if (Get-Command kubectl -ErrorAction SilentlyContinue) {
            foreach ($ns in @("dev", "auth", "default")) {
                try {
                    $checkK8s = kubectl get secret microservices-secrets -n $ns 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        $patchJson = '{"stringData":{"KEYCLOAK_CLIENT_SECRET":"' + $secret + '"}}'
                        kubectl patch secret microservices-secrets -n $ns --type merge -p $patchJson 2>$null | Out-Null
                        Write-Host "  [OK] Synchronized KEYCLOAK_CLIENT_SECRET into Kubernetes secret microservices-secrets (namespace: $ns)" -ForegroundColor Green
                    }
                } catch {}
            }
        }
    }
} catch {
    Write-Host "  Warning: Could not fetch client secret: $_" -ForegroundColor DarkGray
}

# 5. Ensure Roles and Users
Write-Host "`n[5/5] Configuring Roles and Users..." -ForegroundColor Yellow
foreach ($role in @("ADMIN", "USER")) {
    try {
        Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/roles/$role" -ErrorAction Stop | Out-Null
    } catch {
        $rolePayload = @{ name = $role } | ConvertTo-Json
        Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/roles" -Body $rolePayload
        Write-Host "  [OK] Created role: $role" -ForegroundColor Green
    }
}

# Ensure USER role is a default role for newly registered users
try {
    $userRole = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/roles/USER"
    $composites = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/roles/default-roles-$Realm/composites"
    if (-not ($composites | Where-Object { $_.name -eq "USER" })) {
        $addJson = "[$($userRole | ConvertTo-Json)]"
        Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/roles/default-roles-$Realm/composites" -Body $addJson
        Write-Host "  [OK] Assigned USER role to default-roles-$Realm (auto-assigned to new registrants)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Note: Could not link USER into default-roles: $_" -ForegroundColor DarkGray
}

function Ensure-KeycloakUser {
    param (
        [string]$username,
        [string]$password,
        [string[]]$roles,
        [string]$firstName = $null,
        [string]$lastName = $null
    )

    if (-not $firstName) {
        $parts = $username.Split('_')
        $firstName = (Get-Culture).TextInfo.ToTitleCase($parts[0])
    }
    if (-not $lastName) {
        $parts = $username.Split('_')
        if ($parts.Count -gt 1) {
            $lastName = (Get-Culture).TextInfo.ToTitleCase($parts[-1])
        } else {
            $lastName = "Account"
        }
    }

    $users = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/users?username=$username"
    $userId = $null

    $userPayload = @{
        username = $username
        firstName = $firstName
        lastName = $lastName
        email = "$username@example.com"
        emailVerified = $true
        enabled = $true
        requiredActions = @()
    }

    if (-not $users -or $users.Count -eq 0) {
        $userCreatePayload = $userPayload.Clone()
        $userCreatePayload["credentials"] = @(@{ type = "password"; value = $password; temporary = $false })
        Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/users" -Body ($userCreatePayload | ConvertTo-Json)
        $users = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/users?username=$username"
        $userId = $users[0].id
        Write-Host "  [OK] User '$username' created (Profile: $firstName $lastName, Email: $username@example.com)." -ForegroundColor Green
    } else {
        $userId = $users[0].id
        # Update user profile to ensure firstName, lastName, email, and clear all required actions
        Invoke-KeycloakAdmin -Method Put -Uri "$KeycloakUrl/admin/realms/$Realm/users/$userId" -Body ($userPayload | ConvertTo-Json)
        Write-Host "  [OK] User '$username' profile updated ($firstName $lastName, no required actions)." -ForegroundColor DarkGray
    }

    # Set password explicitly & ensure temporary=false
    try {
        $pwdPayload = @{ type = "password"; value = $password; temporary = $false } | ConvertTo-Json
        Invoke-KeycloakAdmin -Method Put -Uri "$KeycloakUrl/admin/realms/$Realm/users/$userId/reset-password" -Body $pwdPayload
    } catch {
        Write-Host "  Note: Password set advisory for $($username): $_" -ForegroundColor DarkGray
    }

    # Map all requested roles
    if ($roles) {
        $roleObjs = @()
        foreach ($r in $roles) {
            try {
                $rObj = Invoke-KeycloakAdmin -Method Get -Uri "$KeycloakUrl/admin/realms/$Realm/roles/$r"
                $roleObjs += $rObj
            } catch {}
        }
        if ($roleObjs.Count -gt 0) {
            $roleMapPayload = $roleObjs | ConvertTo-Json -Compress
            if (-not ($roleMapPayload.StartsWith("["))) {
                $roleMapPayload = "[$roleMapPayload]"
            }
            try {
                Invoke-KeycloakAdmin -Method Post -Uri "$KeycloakUrl/admin/realms/$Realm/users/$userId/role-mappings/realm" -Body $roleMapPayload
            } catch {}
        }
    }
}

Ensure-KeycloakUser -username "admin_user" -password "admin" -roles @("ADMIN", "USER") -firstName "Admin" -lastName "User"
Ensure-KeycloakUser -username "basic_user" -password "password" -roles @("USER") -firstName "Basic" -lastName "User"

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  KEYCLOAK BOOTSTRAP COMPLETE!                        " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
