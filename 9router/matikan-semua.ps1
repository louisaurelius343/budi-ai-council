# Matikan Budi Gateway dan 9router sekaligus.
Stop-ScheduledTask -TaskName 'Budi Gateway' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='codex.exe' OR Name='hermes.exe'" |
    Where-Object { $_.CommandLine -match 'openclaw|codex|hermes|9router' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host 'Budi Gateway dan 9router sudah dimatikan.'
