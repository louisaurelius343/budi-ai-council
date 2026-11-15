# Matikan 9router saja.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match '9router' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host '9router sudah dimatikan.'
