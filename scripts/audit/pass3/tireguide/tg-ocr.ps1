# Local OCR of a screenshot using the built-in Windows.Media.Ocr engine (no install, no model cost).
#   powershell -NoProfile -File tg-ocr.ps1 <png> [-Lines]   → prints recognized text (one line per OCR line)
param([Parameter(Mandatory)][string]$Path, [switch]$Lines, [int]$Scale = 3, [string]$Crop = "")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.RandomAccessStream, Windows.Foundation, ContentType = WindowsRuntime]
function Await($WinRtTask, $ResultType) {
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $t = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask)); $t.Wait() | Out-Null; $t.Result
}
# upscale for better OCR on small UI fonts
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Path).Path)
if ($Crop) { $cx, $cy, $cw, $ch = ($Crop -split ",") | ForEach-Object { [int]$_ }; $rect = New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch; $cropped = (New-Object System.Drawing.Bitmap $src).Clone($rect, $src.PixelFormat); $src.Dispose(); $src = $cropped }
$bmp2 = New-Object System.Drawing.Bitmap ($src.Width * $Scale), ($src.Height * $Scale)
$g = [System.Drawing.Graphics]::FromImage($bmp2); $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, $bmp2.Width, $bmp2.Height); $g.Dispose(); $src.Dispose()
$tmp = [IO.Path]::Combine([IO.Path]::GetTempPath(), "tg-ocr-" + [IO.Path]::GetFileName($Path))
$bmp2.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png); $bmp2.Dispose()
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US")) }
$res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
foreach ($l in $res.Lines) { $l.Text }
