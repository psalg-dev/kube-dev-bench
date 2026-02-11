$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

npm --prefix frontend test -- --verbose
