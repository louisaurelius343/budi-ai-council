@echo off
rem Jalankan 9router hanya di 127.0.0.1 (bawaannya 0.0.0.0 = terbuka ke seluruh WiFi).
rem Nyalakan dari terminal/Explorer biasa. Jangan dari Task Scheduler atau sandbox: data dashboard bisa terpisah.
9router --host 127.0.0.1 --port 20128 --no-browser --skip-update --log < NUL >> "%~dp09router.log" 2>&1
