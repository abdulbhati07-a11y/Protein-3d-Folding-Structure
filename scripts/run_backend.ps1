$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "backend")
& (Join-Path $Root "venv\Scripts\python.exe") wsgi.py
