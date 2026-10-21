[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'start',

    [ValidateRange(1, 600)]
    [int]$StartupTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$runtimeDir = Join-Path $PSScriptRoot '.dev-processes'
$statePath = Join-Path $runtimeDir 'state.json'
$stdoutPath = Join-Path $runtimeDir 'stdout.log'

function Get-ProcessIdentity($Process) {
    return @{
        Id = [int]$Process.ProcessId
        Created = $Process.CreationDate.ToUniversalTime().ToString('o')
    }
}

function Get-ManagedProcesses {
    if (-not (Test-Path $statePath)) { return }
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $all = @(Get-CimInstance Win32_Process)
    $owned = @{}
    foreach ($saved in $state.Processes) {
        foreach ($process in $all) {
            if ($process.ProcessId -eq $saved.Id -and
                $process.CreationDate.ToUniversalTime().ToString('o') -eq $saved.Created) {
                $owned[[int]$process.ProcessId] = $process
            }
        }
    }

    # Include npm, concurrently and their descendants, but never a reused PID.
    do {
        $added = $false
        foreach ($process in $all) {
            $parent = $owned[[int]$process.ParentProcessId]
            if ($parent -and -not $owned.ContainsKey([int]$process.ProcessId) -and
                $process.CreationDate -ge $parent.CreationDate) {
                $owned[[int]$process.ProcessId] = $process
                $added = $true
            }
        }
    } while ($added)
    return $owned.Values
}

function Save-Processes($Processes) {
    @{ Processes = @($Processes | ForEach-Object { Get-ProcessIdentity $_ }) } |
        ConvertTo-Json -Depth 4 | Set-Content $statePath -Encoding UTF8
}

function Stop-Development {
    $processes = @(Get-ManagedProcesses)
    foreach ($process in ($processes | Sort-Object CreationDate)) {
        $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ProcessId)"
        if ($current -and $current.CreationDate -eq $process.CreationDate) {
            Stop-Process -Id $process.ProcessId -Force
        }
    }
    foreach ($process in $processes) {
        $current = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
        if ($current -and $current.StartTime.ToUniversalTime() -eq $process.CreationDate.ToUniversalTime()) {
            $current | Wait-Process -Timeout 10
        }
    }
    if (Test-Path $statePath) { Remove-Item $statePath }
    Write-Host 'Ambiente parado. Nenhum processo externo ao script foi encerrado.'
}

function Start-Development {
    $running = @(Get-ManagedProcesses)
    if ($running.Count) {
        Write-Host 'O ambiente ja possui processos ativos. Use .\dev.ps1 status ou restart.'
        return
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'npm.cmd nao encontrado. Instale o Node.js e abra novamente o PowerShell.'
    }
    if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\.bin\concurrently.cmd'))) {
        throw 'Dependencias ausentes. Execute npm install antes de iniciar.'
    }

    Set-Content $stdoutPath -Value '' -Encoding UTF8
    $escapedLogPath = $stdoutPath.Replace("'", "''")
    $consoleCommand = @"
`$Host.UI.RawUI.WindowTitle = 'IoT Dashboard - Vite e API'
& `$env:ComSpec /d /c 'npm.cmd run dev:all 2>&1' | Tee-Object -FilePath '$escapedLogPath'
exit `$LASTEXITCODE
"@
    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($consoleCommand))
    $launcher = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encodedCommand" `
        -WorkingDirectory $PSScriptRoot -WindowStyle Normal -PassThru
    try {
        $root = Get-CimInstance Win32_Process -Filter "ProcessId = $($launcher.Id)"
        if (-not $root) { throw 'npm encerrou antes de iniciar os servidores.' }
        Save-Processes @($root)
        $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
        $pending = 'Vite e proxy'
        $lastProbeError = $null
        Write-Host "Aguardando Vite e proxy (ate $StartupTimeoutSeconds segundos)..."
        do {
            $processes = @(Get-ManagedProcesses)
            if (-not $processes.Count) { throw 'Os processos de desenvolvimento encerraram durante a inicializacao.' }
            Save-Processes $processes
            $output = [string](Get-Content $stdoutPath -Raw) -replace '\x1b\[[0-9;]*m', ''
            $web = [regex]::Match($output, 'Local:\s+(http://localhost:\d+/)')
            $api = [regex]::Match($output, 'IoT proxy em (http://localhost:\d+)')
            $pending = if (-not $web.Success -and -not $api.Success) { 'Vite e proxy' }
                elseif (-not $web.Success) { 'Vite' }
                elseif (-not $api.Success) { 'proxy' }
                else { 'respostas HTTP do Vite e do proxy' }
            if ($web.Success -and $api.Success) {
                $webUrl = $web.Groups[1].Value
                $apiUrl = $api.Groups[1].Value
                try {
                    $pending = 'resposta HTTP do Vite'
                    $null = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 5
                    $pending = 'resposta HTTP do proxy'
                    $health = Invoke-RestMethod -Uri "$apiUrl/api/health" -TimeoutSec 5
                    if (-not $health.ok) { throw 'O proxy nao confirmou o estado saudavel.' }
                    Write-Host "SPA: $webUrl"
                    Write-Host "API: $apiUrl"
                    Write-Host "Logs ao vivo na janela 'IoT Dashboard - Vite e API' e em $stdoutPath"
                    Write-Host 'Para encerrar: .\dev.ps1 stop'
                    return
                } catch {
                    $lastProbeError = $_.Exception.Message
                }
            }
            Start-Sleep -Milliseconds 300
        } while ((Get-Date) -lt $deadline)
        $detail = if ($lastProbeError) { " Ultima falha HTTP: $lastProbeError" } else { '' }
        throw "Tempo esgotado apos $StartupTimeoutSeconds segundos aguardando: $pending.$detail"
    } catch {
        $failure = $_
        Stop-Development
        throw "$($failure.Exception.Message) Consulte $stdoutPath."
    }
}

if ($env:OS -ne 'Windows_NT') { throw 'Este script requer PowerShell no Windows.' }
$null = New-Item -ItemType Directory -Path $runtimeDir -Force
$lock = $null
try {
    $lock = [System.IO.File]::Open((Join-Path $runtimeDir 'control.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    switch ($Action) {
        'start' { Start-Development }
        'stop' { Stop-Development }
        'restart' { Stop-Development; Start-Development }
        'status' {
            $processes = @(Get-ManagedProcesses)
            if ($processes.Count) {
                Save-Processes $processes
                $processes | Select-Object ProcessId, ParentProcessId, Name | Format-Table -AutoSize
                Write-Host "Logs: $runtimeDir"
            } else {
                Write-Host 'Ambiente parado.'
            }
        }
    }
} finally {
    if ($lock) { $lock.Dispose() }
}
