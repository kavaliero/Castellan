# zip-project.ps1
# Crée un zip léger du projet Castellan pour relecture,
# en excluant tout ce qui est lourd / inutile / sensible.

$ProjectRoot = $PSScriptRoot
$ProjectName = Split-Path $ProjectRoot -Leaf
$Timestamp   = Get-Date -Format "yyyy-MM-dd_HHmm"
$ZipName     = "${ProjectName}_review_${Timestamp}.zip"
$ZipPath     = Join-Path (Split-Path $ProjectRoot -Parent) $ZipName
$TempDir     = Join-Path $env:TEMP "castellan_zip_$Timestamp"

# Dossiers et fichiers à exclure
$ExcludeDirs = @(
    'node_modules',
    '.git',
    '.claude',
    '.vscode',
    '.idea',
    'dist',
    'build',
    '.vite',
    'docs'
)

$ExcludeFiles = @(
    '*.db',
    '*.db-journal',
    '*.log',
    '*.swp',
    '*.swo',
    '*.mp4',
    '.env',
    '.env.*',
    'pnpm-lock.yaml',
    'Thumbs.db',
    'Desktop.ini',
    '.DS_Store',
    'test-*.ps1',
    'zip-project.ps1'
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Castellan - Zip pour relecture" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Copier les fichiers dans un dossier temporaire en filtrant
Write-Host "[1/3] Collecte des fichiers..." -ForegroundColor Yellow

if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Path $TempDir | Out-Null

$AllFiles = Get-ChildItem -Path $ProjectRoot -Recurse -File -Force

$Included = @()
foreach ($File in $AllFiles) {
    $RelativePath = $File.FullName.Substring($ProjectRoot.Length + 1)
    $Skip = $false

    # Vérifier les dossiers exclus
    foreach ($Dir in $ExcludeDirs) {
        if ($RelativePath -like "$Dir\*" -or $RelativePath -like "*\$Dir\*") {
            $Skip = $true
            break
        }
    }

    # Vérifier les fichiers exclus
    if (-not $Skip) {
        foreach ($Pattern in $ExcludeFiles) {
            if ($File.Name -like $Pattern) {
                $Skip = $true
                break
            }
        }
    }

    if (-not $Skip) {
        $Included += $RelativePath
        $DestPath = Join-Path $TempDir $RelativePath
        $DestDir  = Split-Path $DestPath -Parent
        if (-not (Test-Path $DestDir)) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        }
        Copy-Item $File.FullName -Destination $DestPath
    }
}

Write-Host "   $($Included.Count) fichiers inclus" -ForegroundColor Green

# 2. Créer le zip
Write-Host "[2/3] Compression..." -ForegroundColor Yellow

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path "$TempDir\*" -DestinationPath $ZipPath -CompressionLevel Optimal

# 3. Nettoyage
Write-Host "[3/3] Nettoyage..." -ForegroundColor Yellow
Remove-Item $TempDir -Recurse -Force

# Résumé
$ZipSize = (Get-Item $ZipPath).Length
$SizeKB  = [math]::Round($ZipSize / 1KB, 1)
$SizeMB  = [math]::Round($ZipSize / 1MB, 2)

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Zip créé avec succès !" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Fichier : $ZipPath" -ForegroundColor White
if ($SizeMB -ge 1) {
    Write-Host "  Taille  : $SizeMB MB ($SizeKB KB)" -ForegroundColor White
} else {
    Write-Host "  Taille  : $SizeKB KB" -ForegroundColor White
}
Write-Host "  Fichiers: $($Included.Count)" -ForegroundColor White
Write-Host ""

# Liste des fichiers inclus (optionnel, décommenter pour debug)
# Write-Host "Fichiers inclus :" -ForegroundColor DarkGray
# $Included | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
