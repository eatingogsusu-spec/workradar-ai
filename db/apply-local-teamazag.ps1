param(
  [string]$DatabaseName = "teamazag_front_check",
  [string]$User = "postgres",
  [string]$HostName = "localhost",
  [int]$Port = 55432,
  [string]$PsqlBin = "C:\Program Files\PostgreSQL\16\bin"
)

$ErrorActionPreference = "Stop"

$createdb = Join-Path $PsqlBin "createdb.exe"
$dropdb = Join-Path $PsqlBin "dropdb.exe"
$psql = Join-Path $PsqlBin "psql.exe"

if (-not (Test-Path $createdb)) { throw "createdb.exe not found: $createdb" }
if (-not (Test-Path $dropdb)) { throw "dropdb.exe not found: $dropdb" }
if (-not (Test-Path $psql)) { throw "psql.exe not found: $psql" }

if (-not $env:PGPASSWORD) {
  Write-Host "PGPASSWORD is not set. This is fine for the local trust cluster on port 55432; set it when using a password-protected PostgreSQL service."
}

Push-Location (Join-Path $PSScriptRoot "..")
try {
  & $dropdb -h $HostName -p $Port -U $User --if-exists $DatabaseName
  & $createdb -h $HostName -p $Port -U $User $DatabaseName
  & $psql -h $HostName -p $Port -U $User -d $DatabaseName -v ON_ERROR_STOP=1 -f "db/schema.postgresql.sql"
  & $psql -h $HostName -p $Port -U $User -d $DatabaseName -v ON_ERROR_STOP=1 -f "db/verify.postgresql.sql"
}
finally {
  Pop-Location
}
