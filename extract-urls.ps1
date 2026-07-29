param([string]$File)
$t = Get-Content -Raw $File
$n = $t.Replace('\/', '/').Replace('\_', '_')
$matches = [regex]::Matches($n, 'https://media\.v2\.siweb\.es/(uploaded_thumb_big|immagegrabber_thumb_big)/([^"\s]+?\.(?:jpg|jpeg|png|webp|gif))')
$out = foreach ($m in $matches) { $m.Value }
$out | Sort-Object -Unique
