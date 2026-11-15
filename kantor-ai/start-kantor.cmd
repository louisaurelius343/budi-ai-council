@echo off
title Kantor AI
echo Kantor AI berjalan di http://127.0.0.1:7777  (tutup jendela ini untuk berhenti)
start "" http://127.0.0.1:7777
node "%~dp0server.mjs"
