<#
Dilaksi Task 08 — Broken Link / 404 Monitor
Screaming Frog SEO Spider CLI — connectivity test ONLY.

Purpose: prove Claude Code -> Windows -> ScreamingFrogSEOSpiderCli.exe -> CLI
responds successfully, without performing any crawl and without touching
ledsone.co.uk or any production system.

This script does NOT:
  - crawl any URL
  - read or print any licence key, API key, password, or token
  - modify the DM Dashboard application
  - modify the Windows PATH

Usage:
  powershell -File test-cli.ps1
#>

$ErrorActionPreference = 'Stop'

$CliPath = "C:\Program Files (x86)\Screaming Frog SEO Spider\ScreamingFrogSEOSpiderCli.exe"

if (-not (Test-Path $CliPath)) {
    Write-Output "FAIL: CLI executable not found at $CliPath"
    exit 1
}

Write-Output "Found CLI at: $CliPath"
Write-Output "File version: $((Get-Item $CliPath).VersionInfo.FileVersion)"
Write-Output ""
Write-Output "Running --help (no crawl, no network activity)..."
Write-Output ""

& $CliPath --help

if ($LASTEXITCODE -eq 0) {
    Write-Output ""
    Write-Output "PASS: CLI responded successfully."
} else {
    Write-Output ""
    Write-Output "FAIL: CLI exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
}
