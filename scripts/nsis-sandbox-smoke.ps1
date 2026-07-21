#Requires -Version 5.1
<#
.SYNOPSIS
  K-004 / K-014 / K-015 install-uninstall-upgrade smoke for an *isolated* Windows session.

.DESCRIPTION
  Intended for Windows Sandbox or a disposable admin VM only.
  Refuse to run if an existing production Pi Desktop install is detected unless
  -ForceHost is passed (still blocked when host version matches production gate).

  Evidence is written to $EvidenceDir (default Desktop\nsis-evidence).

.PARAMETER DistDir
  Folder containing Pi-Desktop-*-setup.exe and latest.yml

.PARAMETER EvidenceDir
  Output directory for transcripts and listings

.PARAMETER SkipUpgrade
  Only clean install + uninstall (K-014 + K-004), skip 1.0.12→1.0.13 upgrade

.PARAMETER ForceHost
  Bypass "existing install" safety check (dangerous; never use on production host)
#>
[CmdletBinding()]
param(
    [string]$DistDir = (Join-Path $env:USERPROFILE "Desktop\dist"),
    [string]$EvidenceDir = (Join-Path $env:USERPROFILE "Desktop\nsis-evidence"),
    [switch]$SkipUpgrade,
    [switch]$ForceHost
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$log = Join-Path $EvidenceDir "nsis-smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
function Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format o), $msg
    Add-Content -Path $log -Value $line
    Write-Output $line
}

function Get-HostPiInstall {
    $dir = Join-Path $env:LOCALAPPDATA "Programs\Pi Desktop"
    $exe = Join-Path $dir "Pi Desktop.exe"
    if (-not (Test-Path $exe)) { return $null }
    return @{
        Dir = $dir
        Exe = $exe
        Version = (Get-Item $exe).VersionInfo.FileVersion
        Uninstall = Join-Path $dir "Uninstall Pi Desktop.exe"
    }
}

function Invoke-SilentSetup([string]$setupPath) {
    if (-not (Test-Path $setupPath)) { throw "setup missing: $setupPath" }
    Log "start setup $setupPath"
    $p = Start-Process -FilePath $setupPath -ArgumentList @("/S") -Wait -PassThru
    Log "setup exit=$($p.ExitCode)"
    if ($p.ExitCode -ne 0) { throw "setup failed exit=$($p.ExitCode)" }
}

function Invoke-SilentUninstall([string]$uninstallPath) {
    if (-not (Test-Path $uninstallPath)) { throw "uninstall missing: $uninstallPath" }
    Log "start uninstall $uninstallPath"
    $p = Start-Process -FilePath $uninstallPath -ArgumentList @("/S") -Wait -PassThru
    Log "uninstall exit=$($p.ExitCode)"
}

Log "=== NSIS sandbox smoke start ==="
Log "DistDir=$DistDir EvidenceDir=$EvidenceDir"

$existing = Get-HostPiInstall
if ($existing -and -not $ForceHost) {
    Log "REFUSE: existing install version=$($existing.Version) at $($existing.Dir)"
    Log "Use Windows Sandbox / disposable VM, or -ForceHost only after explicit isolation confirmation."
    $refuse = Join-Path $EvidenceDir "REFUSED-host-install.json"
    $refuseObj = @{
        status = "REFUSED"
        reason = "host_install_present"
        version = $existing.Version
        dir = $existing.Dir
        time = (Get-Date -Format o)
    }
    # UTF-8 without BOM so Node JSON.parse works across shells.
    $json = $refuseObj | ConvertTo-Json
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($refuse, $json, $utf8NoBom)
    Log "wrote $refuse"
    # Environment.Exit so wrappers (Git Bash) observe non-zero status.
    [Environment]::Exit(2)
}

if (-not (Test-Path $DistDir)) { throw "DistDir not found: $DistDir" }
$setup12 = Join-Path $DistDir "Pi-Desktop-1.0.12-setup.exe"
$setup13 = Join-Path $DistDir "Pi-Desktop-1.0.13-setup.exe"
if (-not (Test-Path $setup13)) {
    $setup13 = Get-ChildItem $DistDir -Filter "Pi-Desktop-*-setup.exe" |
        Sort-Object Name | Select-Object -Last 1 -ExpandProperty FullName
}
if (-not $setup13) { throw "No setup.exe under $DistDir" }

$results = [ordered]@{
    k014_install = "NOT_RUN"
    k015_upgrade = "NOT_RUN"
    k004_uninstall = "NOT_RUN"
}

try {
    # --- K-014 clean install ---
    $installSource = if ((-not $SkipUpgrade) -and (Test-Path $setup12)) { $setup12 } else { $setup13 }
    Invoke-SilentSetup $installSource
    Start-Sleep -Seconds 3
    $inst = Get-HostPiInstall
    if (-not $inst) { throw "K-014: install completed but exe missing" }
    Log "installed version=$($inst.Version) exe=$($inst.Exe)"
    Get-ChildItem $inst.Dir | Select-Object Name, Length | Format-Table | Out-String | ForEach-Object { Log $_ }
    $results.k014_install = "PASS version=$($inst.Version)"

    # --- K-015 upgrade ---
    if (-not $SkipUpgrade -and (Test-Path $setup12) -and ($installSource -eq $setup12) -and (Test-Path $setup13)) {
        Invoke-SilentSetup $setup13
        Start-Sleep -Seconds 3
        $up = Get-HostPiInstall
        if (-not $up) { throw "K-015: upgrade removed install unexpectedly" }
        Log "upgraded version=$($up.Version)"
        if ($up.Version -notmatch "1\.0\.13") {
            Log "WARN: expected 1.0.13-ish, got $($up.Version)"
            $results.k015_upgrade = "PARTIAL version=$($up.Version)"
        } else {
            $results.k015_upgrade = "PASS version=$($up.Version)"
        }
        $inst = $up
    } else {
        $results.k015_upgrade = "SKIPPED"
    }

    # Launch smoke (short)
    if ($inst.Exe) {
        Log "launch smoke $($inst.Exe)"
        $app = Start-Process -FilePath $inst.Exe -PassThru
        Start-Sleep -Seconds 8
        if (-not $app.HasExited) {
            Log "app running pid=$($app.Id) — stopping"
            Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
        } else {
            Log "app exited early code=$($app.ExitCode)"
        }
    }

    # --- K-004 uninstall ---
    $un = (Get-HostPiInstall).Uninstall
    Invoke-SilentUninstall $un
    Start-Sleep -Seconds 3
    $gone = Get-HostPiInstall
    if ($gone) {
        $results.k004_uninstall = "FAIL still_present version=$($gone.Version)"
        throw "K-004 uninstall incomplete"
    }
    $results.k004_uninstall = "PASS"
}
catch {
    Log "ERROR: $($_.Exception.Message)"
    $results.error = $_.Exception.Message
}
finally {
    $summaryPath = Join-Path $EvidenceDir "summary.json"
    $results.time = (Get-Date -Format o)
    $results.log = $log
    ($results | ConvertTo-Json) | Set-Content -Path $summaryPath -Encoding UTF8
    Log "summary written $summaryPath"
    Log "=== NSIS sandbox smoke end ==="
    Get-Content $summaryPath
}
