$envf = "D:\budi\.openclaw\.env"
$cfg = @{}
foreach ($line in Get-Content $envf) {
  if ($line -match "^\s*#") { continue }
  $i = $line.IndexOf("="); if ($i -lt 1) { continue }
  $cfg[$line.Substring(0,$i).Trim()] = $line.Substring($i+1).Trim().Trim(''"'').Trim("'"'"'")
}

# tunggu gateway Budi siap (maks ~60 dtk); kalau Budi mati, keluar diam-diam
$ok = $false
for ($i=0; $i -lt 20; $i++) {
  try { $t = New-Object Net.Sockets.TcpClient; $t.Connect("127.0.0.1",18789); $t.Close(); $ok=$true; break }
  catch { Start-Sleep 3 }
}
if (-not $ok) { exit 0 }

# cek mention; ambil jumlah yang BARU dari baris pertama output
$out = python D:\labs\sosmed\cek_mention.py
$baru = 0
$first = $out | Select-Object -First 1
if ($first -match "(\d+) mention baru") { $baru = [int]$matches[1] }
if ($baru -le 0) { exit 0 }

# sentil Budi lewat hook -> dia jalankan skill bales-mention (draf + kirim ke WA)
$body = @{
  message = "Ada $baru mention/balasan baru di Bluesky. Jalankan skill bales-mention: buat draf balasan tiap item lalu kirim ke saya di WhatsApp untuk konfirmasi dulu sebelum posting."
  deliver = $true
  channel = "whatsapp"
  to      = $cfg["WA_TUJUAN"]
} | ConvertTo-Json
$headers = @{ "Authorization" = "Bearer $($cfg['OPENCLAW_HOOK_TOKEN'])"; "Idempotency-Key" = "mention-$(Get-Date -Format yyyyMMddHHmm)" }
try { Invoke-RestMethod "http://127.0.0.1:18789/hooks/agent" -Method Post -Body $body -ContentType "application/json" -Headers $headers | Out-Null } catch { Write-Host $_ }
