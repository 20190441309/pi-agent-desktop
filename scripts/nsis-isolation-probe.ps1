# NSIS isolation capability probe — no install, no elevation required for reads.
$ErrorActionPreference = "Continue"
Write-Output "=== NSIS isolation probe ==="
Write-Output "time=$(Get-Date -Format o)"
Write-Output "user=$env:USERNAME"
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Output "admin=$admin"
Write-Output "identity=$([Security.Principal.WindowsIdentity]::GetCurrent().Name)"

$sandboxPaths = @(
    "$env:SystemRoot\System32\WindowsSandbox.exe",
    "$env:SystemRoot\Sysnative\WindowsSandbox.exe"
)
foreach ($p in $sandboxPaths) {
    if (Test-Path $p) { Write-Output "sandbox_exe=$p" } else { Write-Output "missing=$p" }
}
$cmd = Get-Command WindowsSandbox -ErrorAction SilentlyContinue
if ($cmd) { Write-Output "sandbox_cmd=$($cmd.Source)" } else { Write-Output "sandbox_cmd=none" }

try {
    $state = (Get-WindowsOptionalFeature -Online -FeatureName "Containers-DisposableClientVM" -ErrorAction Stop).State
    Write-Output "sandbox_feature=$state"
} catch {
    Write-Output "sandbox_feature_query=$($_.Exception.Message)"
}

try {
    $hv = (Get-CimInstance Win32_ComputerSystem).HypervisorPresent
    Write-Output "hypervisor_present=$hv"
} catch {
    Write-Output "hypervisor_query_failed"
}

foreach ($tool in @("docker", "VBoxManage", "vmrun", "qemu-system-x86_64")) {
    $c = Get-Command $tool -ErrorAction SilentlyContinue
    if ($c) { Write-Output "tool_$tool=$($c.Source)" } else { Write-Output "tool_$tool=missing" }
}

try {
    wsl -l -v 2>&1 | ForEach-Object { Write-Output "wsl:$_" }
} catch {
    Write-Output "wsl_query_failed"
}

try {
    $u = "pi-nsis-" + ([guid]::NewGuid().ToString("N").Substring(0, 8))
    New-LocalUser -Name $u -NoPassword -ErrorAction Stop | Out-Null
    Write-Output "create_user=ok name=$u"
    Remove-LocalUser -Name $u -ErrorAction SilentlyContinue
} catch {
    Write-Output "create_user_blocked=$($_.Exception.Message)"
}

$pi = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match "Pi Desktop" }
if ($pi) {
    Write-Output "host_pi_name=$($pi.DisplayName)"
    Write-Output "host_pi_version=$($pi.DisplayVersion)"
    Write-Output "host_pi_uninstall=$($pi.UninstallString)"
} else {
    Write-Output "host_pi=none_in_hkcu"
}

$installDir = Join-Path $env:LOCALAPPDATA "Programs\Pi Desktop"
if (Test-Path $installDir) {
    Write-Output "host_pi_dir=$installDir"
    $exe = Join-Path $installDir "Pi Desktop.exe"
    if (Test-Path $exe) {
        $vi = (Get-Item $exe).VersionInfo
        Write-Output "host_pi_file_version=$($vi.FileVersion)"
    }
}

Write-Output "decision=BLOCKED_if_no_sandbox_and_host_has_production_install"
Write-Output "forbid_host_setup_uninstall=true"
