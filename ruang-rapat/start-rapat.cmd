@echo off
title Ruang Rapat Dewan
echo Ruang Rapat Dewan di http://127.0.0.1:7788  (tutup jendela ini untuk berhenti)
echo Pastikan 9router sudah menyala.
start "" http://127.0.0.1:7788
node "%~dp0server.mjs"
