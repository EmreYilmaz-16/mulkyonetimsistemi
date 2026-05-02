param(
    [Parameter(Mandatory = $true)]
    [string]$CommitMessage,

    [string]$RemoteHost = 'pbs@192.168.99.121',

    [string]$RemotePath = '/home/pbs/docker-stack/mulkyonetimsistemi',

    [string]$Branch = 'main',

    [string[]]$PreserveRemoteFiles = @('docker-compose.yml'),

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Action
}

function Invoke-LoggedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [switch]$AllowFailure
    )

    Write-Host "   $Command" -ForegroundColor DarkGray

    if ($DryRun) {
        return
    }

    & pwsh -NoLogo -NoProfile -Command $Command
    if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command"
    }
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $rendered = ($Arguments | ForEach-Object {
        if ($_ -match '\s') {
            '"{0}"' -f $_
        } else {
            $_
        }
    }) -join ' '

    Write-Host "   $FilePath $rendered" -ForegroundColor DarkGray

    if ($DryRun) {
        return
    }

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code ${LASTEXITCODE}."
    }
}

$repoRoot = Resolve-Path -Path $PSScriptRoot
Set-Location -Path $repoRoot

$statusOutput = git status --short
if (-not $statusOutput) {
    throw 'Working tree is clean. There is nothing to deploy.'
}

Invoke-Step -Description 'Create a focused local commit' -Action {
    Invoke-ExternalCommand -FilePath 'git' -Arguments @('add', '-A')
    Invoke-ExternalCommand -FilePath 'git' -Arguments @('commit', '-m', $CommitMessage)
}

Invoke-Step -Description 'Push the commit to GitHub' -Action {
    Invoke-ExternalCommand -FilePath 'git' -Arguments @('push', 'origin', $Branch)
}

$preserveFilesShell = ($PreserveRemoteFiles | ForEach-Object { "'$_'" }) -join ' '
$remoteScriptTemplate = @'
set -e
cd '__REMOTE_PATH__'

if [ -n "$(git status --porcelain)" ]; then
    git stash push -m 'pre-deploy-preserved-files'
    STASH_CREATED=1
else
    STASH_CREATED=0
fi

git pull --ff-only origin '__BRANCH__'

if [ "$STASH_CREATED" -eq 1 ]; then
    for file in __PRESERVE_FILES__; do
        git checkout stash@{0} -- "$file"
    done
    git stash drop stash@{0}
fi

docker compose up -d --build
git status --short
'@

$remoteScript = $remoteScriptTemplate.Replace('__REMOTE_PATH__', $RemotePath).Replace('__BRANCH__', $Branch).Replace('__PRESERVE_FILES__', $preserveFilesShell)

Invoke-Step -Description 'Pull and rebuild on the remote server' -Action {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
    $pythonCode = "import base64, subprocess; script = base64.b64decode('$encoded').decode('utf-8'); raise SystemExit(subprocess.run(['bash', '-lc', script], check=False).returncode)"
    $remoteCommand = 'python3 -c "' + $pythonCode + '"'
    Invoke-ExternalCommand -FilePath 'ssh' -Arguments @($RemoteHost, $remoteCommand)
}

Write-Host ''
Write-Host 'Deployment completed successfully.' -ForegroundColor Green