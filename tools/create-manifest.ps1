param(
  [string]$AssetsDir = (Join-Path $PSScriptRoot '..\release-assets'),
  [string]$Output = (Join-Path $PSScriptRoot '..\manifest.json'),
  [string]$ModpackVersion = '1.0.0',
  [string]$ForgeVersion = '1.19.2-forge-43.5.0'
)
$ErrorActionPreference = 'Stop'
$AssetsDir = (Resolve-Path $AssetsDir).Path
$files = @()
$mods = Get-ChildItem -LiteralPath $AssetsDir -File -Filter '*.jar' | Sort-Object Name
if (-not $mods) { throw "No se encontraron archivos .jar en $AssetsDir. Copia tus mods ahí primero." }
foreach ($mod in $mods) {
  $hash = (Get-FileHash -LiteralPath $mod.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $files += [ordered]@{
    path = "mods/$($mod.Name)"
    asset = $mod.Name
    sha256 = $hash
    size = $mod.Length
  }
}
$manifest = [ordered]@{
  version = $ModpackVersion
  minecraftVersion = '1.19.2'
  forgeVersion = $ForgeVersion
  files = $files
}
$json = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($Output, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host "Manifiesto creado: $Output"
Write-Host "Mods incluidos: $($mods.Count)"
Write-Host "Ahora adjunta manifest.json y TODOS los .jar de release-assets a una GitHub Release."
