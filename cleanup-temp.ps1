$gallery = 'C:\Users\Usuario\Projects\aplidec-clon\assets\img\gallery'
$toDelete = @('img_4326_original.jpg', 'img_4327_original.jpg', 'img_4328_original.jpg', 'img_4329_original.jpg')
foreach ($f in $toDelete) {
    $p = Join-Path $gallery $f
    if (Test-Path $p) { Remove-Item $p -Force; Write-Host "DELETED $f" } else { Write-Host "MISSING $f" }
}
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\check-dupes.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\original-proyectos.html' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\fetch-original.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\extract-images.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\extract-images2.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\extract-full-gallery.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\inspect-gallery.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\Usuario\Projects\aplidec-clon\download-real-images.ps1' -Force -ErrorAction SilentlyContinue
Write-Host "`n=== FINAL HASH CHECK (gallery) ==="
$hashes = @{}
Get-ChildItem $gallery -File | ForEach-Object {
    $h = (Get-FileHash $_.FullName -Algorithm MD5).Hash.Substring(0,8)
    if ($hashes.ContainsKey($h)) { Write-Host ("DUPLICATE HASH {0}: {1} == {2}" -f $h, $_.Name, $hashes[$h]) }
    else { $hashes[$h] = $_.Name }
    Write-Host ("{0}  {1,10}  {2}" -f $h, $_.Length, $_.Name)
}
Write-Host ("`nTOTAL FILES: " + (Get-ChildItem $gallery -File).Count + " | UNIQUE HASHES: " + $hashes.Count)
