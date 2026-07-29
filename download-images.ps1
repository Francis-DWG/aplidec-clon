$ErrorActionPreference = 'Continue'
$base = 'C:\Users\Usuario\Projects\aplidec-clon\assets\img'
$gal  = Join-Path $base 'gallery'
$H = 'https://media.v2.siweb.es/uploaded_thumb_big/53ae4e21c33834e890eb27102bf7caa4'
$G = 'https://media.v2.siweb.es/immagegrabber_thumb_big'

$items = @(
  @("$H/logo_web_7.jpg",                        "$base\logo_web_7.jpg"),
  @("$G/Unsplash-BayIzHKkjM4.jpg",              "$base\interior.jpg"),
  @("$H/fachadas_exterior.png",                 "$base\exterior.jpg"),
  @("$H/seguimiento_de_obra_2.png",             "$base\seguimiento_de_obra_2.png"),
  @("$H/fachada_hormigon.jpg",                  "$base\fachada_hormigon.jpg"),
  @("$H/corcho_proyectado_1.jpg",               "$base\corcho_proyectado_1.jpg"),
  @("$H/corcho_normativas_2.jpg",               "$base\corcho_normativas_2.jpg"),
  @("$H/captura_de_pantalla_2025_10_23_a_las_18_25_47.png", "$base\pintura_anti_radon.jpg"),
  @("$G/Unsplash-4ojhpgKpS68.jpg",              "$base\comunidad_propietarios.jpg"),
  @("$G/Unsplash-ULP07chR5EQ.jpg",              "$base\hoteles_residencias.jpg"),
  @("$G/Unsplash-r_X4YHAlBPo.jpg",              "$base\naves_industriales.jpg"),
  @("$H/velo_para_grietas.png",                 "$base\reparacion_grietas.jpg"),
  @("$H/garaje.jpg",                            "$base\parking_garajes.jpg"),
  @("$G/Unsplash-YqFz7UMm8qE.jpg",              "$base\pintura_silicato.jpg"),
  @("$G/Unsplash-75xPHEQBmvA.jpg",              "$base\impermeabilizacion.jpg"),
  @("$G/Unsplash-pg-20HDu9zA.jpg",              "$base\blog_psicologia_color.jpg"),
  @("$H/ac_36.jpg",                             "$gal\ac_36.jpg"),
  @("$H/ac_35.jpg",                             "$gal\ac_35.jpg"),
  @("$H/ac_34.jpg",                             "$gal\ac_34.jpg"),
  @("$H/ac_31.jpg",                             "$gal\ac_31.jpg"),
  @("$H/ac_28.jpg",                             "$gal\ac_28.jpg"),
  @("$H/ac_26.jpg",                             "$gal\ac_26.jpg"),
  @("$H/ac_25.jpg",                             "$gal\ac_25.jpg"),
  @("$H/ac_10.jpg",                             "$gal\ac_10.jpg"),
  @("$H/ac_9.jpg",                              "$gal\ac_9.jpg"),
  @("$H/ac_6.jpg",                              "$gal\ac_6.jpg"),
  @("$H/ac_1.jpg",                              "$gal\ac_1.jpg"),
  @("$H/ac_23.jpg",                             "$gal\ac_23.jpg"),
  @("$H/ac_20.jpg",                             "$gal\ac_20.jpg"),
  @("$H/ac_19.jpg",                             "$gal\ac_19.jpg"),
  @("$H/ac_14.jpg",                             "$gal\ac_14.jpg"),
  @("$H/ac_13.jpg",                             "$gal\ac_13.jpg"),
  @("$H/ac_12.jpg",                             "$gal\ac_12.jpg"),
  @("$H/photo_2024_10_23_14_18_18.jpg",         "$gal\photo_2024_10_23_14_18_18.jpg"),
  @("$H/photo_2024_10_23_14_18_17.jpg",         "$gal\photo_2024_10_23_14_18_17.jpg"),
  @("$H/photo_2024_10_23_14_18_17_2.jpg",       "$gal\photo_2024_10_23_14_18_17_2.jpg"),
  @("$H/aaebcaca_36ff_4fcc_ac27_80d53e9d9d59_1.jpg", "$gal\aaebcaca_36ff_4fcc_ac27_80d53e9d9d59_1.jpg"),
  @("$H/85f6d538_d1f7_493c_931c_92855c2b975a.jpg",   "$gal\85f6d538_d1f7_493c_931c_92855c2b975a.jpg"),
  @("$H/3cd68c31_94b9_4420_9cc1_88e714640f90_1.jpg", "$gal\3cd68c31_94b9_4420_9cc1_88e714640f90_1.jpg"),
  @("$H/dsc01432_original.jpg",                 "$gal\dsc01432_original.jpg"),
  @("$H/dsc00887_original.jpg",                 "$gal\dsc00887_original.jpg"),
  @("$H/dsc01432_original.jpg",                 "$gal\img_4330.jpg"),
  @("$H/dsc01432_original.jpg",                 "$gal\img_4329_original.jpg"),
  @("$H/dsc00887_original.jpg",                 "$gal\img_4328_original.jpg"),
  @("$H/dsc00887_original.jpg",                 "$gal\img_4327_original.jpg"),
  @("$H/dsc01432_original.jpg",                 "$gal\img_4326_original.jpg"),
  @("$H/papel_cabecero_1.jpg",                  "$gal\papel_cabecero_1.jpg"),
  @("$G/Unsplash-8Rz_RIyp5FM.jpg",              "$gal\unsplash_8Rz_RIyp5FM.jpg"),
  @("$G/5bc9b5be046b7.jpg",                     "$gal\5bc9b5be046b7.jpg"),
  @("$G/5bc9b5c7ebf0e.jpg",                     "$gal\5bc9b5c7ebf0e.jpg"),
  @("$G/5bc9b5cfbb5ee.jpg",                     "$gal\5bc9b5cfbb5ee.jpg"),
  @("$G/5bc9b5cdd6c3e.jpg",                     "$gal\5bc9b5cdd6c3e.jpg"),
  @("$G/5bc9b5c9c464d.jpg",                     "$gal\5bc9b5c9c464d.jpg"),
  @("$G/5bc9b5d1582f6.jpg",                     "$gal\5bc9b5d1582f6.jpg")
)

$ok = 0; $fail = 0; $failed = @()
foreach ($it in $items) {
  $url = $it[0]; $dst = $it[1]
  try {
    Invoke-WebRequest -Uri $url -OutFile $dst -UseBasicParsing -TimeoutSec 30 -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    $size = (Get-Item $dst).Length
    if ($size -gt 0) { Write-Output "OK   $size  $dst"; $ok++ }
    else { Write-Output "FAIL 0 bytes  $dst"; $fail++; $failed += $dst }
  } catch {
    Write-Output "FAIL $($_.Exception.Message)  $dst"
    $fail++; $failed += $dst
  }
}
Write-Output "===== RESUMEN: OK=$ok FAIL=$fail ====="
if ($failed.Count -gt 0) { Write-Output "Fallidos:"; $failed | ForEach-Object { Write-Output "  $_" } }
