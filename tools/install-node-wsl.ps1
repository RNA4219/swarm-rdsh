param([string]$Distro = 'Ubuntu')
$ErrorActionPreference = 'Stop'
$version = '24.15.0'
$archiveName = "node-v$version-linux-x64.tar.xz"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$downloads = Join-Path $repoRoot '.runtime/downloads'
New-Item -ItemType Directory -Path $downloads -Force | Out-Null
$archivePath = Join-Path $downloads $archiveName
$checksums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/v$version/SHASUMS256.txt").Content
$line = @($checksums -split '\r?\n' | Where-Object { $_ -match ('  ' + [regex]::Escape($archiveName) + '$') })
if ($line.Count -ne 1) { throw 'Official checksum entry is missing or ambiguous' }
$expectedHash = ($line[0] -split '\s+')[0]
if (-not (Test-Path -LiteralPath $archivePath)) {
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$version/$archiveName" -OutFile $archivePath
}
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Node archive checksum mismatch' }
$linuxHome = (& wsl -d $Distro -- printenv HOME).Trim()
if ($LASTEXITCODE -ne 0 -or $linuxHome -notmatch '^/home/[A-Za-z0-9_-]+$') { throw 'Unexpected WSL home path' }
$prefix = "$linuxHome/.local/share/deepflow-swarm/node-v$version-linux-x64"
& wsl -d $Distro -- test -e $prefix
if ($LASTEXITCODE -eq 0) { throw 'Node installation target already exists; inspect it instead of overwriting' }
$linuxArchiveOutput = & wsl -d $Distro -- wslpath -a ($archivePath.Replace('\', '/'))
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve archive path in WSL' }
$linuxArchive = ($linuxArchiveOutput -join '').Trim()
& wsl -d $Distro -- mkdir -p $prefix
if ($LASTEXITCODE -ne 0) { throw 'Cannot create task-specific Node directory' }
& wsl -d $Distro -- tar -xf $linuxArchive --strip-components=1 -C $prefix
if ($LASTEXITCODE -ne 0) { throw 'Node archive extraction failed' }
$installed = (& wsl -d $Distro -- "$prefix/bin/node" --version).Trim()
if ($LASTEXITCODE -ne 0 -or $installed -ne "v$version") { throw 'Installed Node version mismatch' }
$binaryHash = ((& wsl -d $Distro -- sha256sum "$prefix/bin/node") -split '\s+')[0]
if ($LASTEXITCODE -ne 0 -or $binaryHash -notmatch '^[a-f0-9]{64}$') { throw 'Cannot hash installed Node binary' }
$record = [ordered]@{ version = $version; platform = 'linux-x64'; path = "$prefix/bin/node"; archive_sha256 = $expectedHash; binary_sha256 = $binaryHash; source = "https://nodejs.org/dist/v$version/$archiveName"; globalPathChanged = $false }
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repoRoot '.runtime/node-install.json') -Encoding utf8
$record | ConvertTo-Json -Compress
