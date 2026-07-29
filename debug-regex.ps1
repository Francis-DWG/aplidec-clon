param([string]$File)
$t = Get-Content -Raw $File
$n = $t -replace '\\/', '/' -replace '\\_', '_'
Write-Output "Longitud original: $($t.Length)  normalizada: $($n.Length)"
$i = $n.IndexOf('uploaded_thumb_big')
Write-Output "Indice uploaded_thumb_big: $i"
if ($i -ge 0) { Write-Output $n.Substring([Math]::Max(0,$i-60), 160) }
$m = [regex]::Matches($n, 'https://media\.v2\.siweb\.es/[^"]+')
Write-Output "Coincidencias https://media: $($m.Count)"
