$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '..\assets'
$artifactDirectory = Join-Path $PSScriptRoot '..\artifacts'
[System.IO.Directory]::CreateDirectory($assetDirectory) | Out-Null
[System.IO.Directory]::CreateDirectory($artifactDirectory) | Out-Null
$bitmap = [System.Drawing.Bitmap]::new(1024, 1024)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#13776F'))
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 46)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$points = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(215, 525), [System.Drawing.PointF]::new(355, 525), [System.Drawing.PointF]::new(430, 355), [System.Drawing.PointF]::new(545, 690), [System.Drawing.PointF]::new(635, 465), [System.Drawing.PointF]::new(685, 525), [System.Drawing.PointF]::new(809, 525))
$graphics.DrawLines($pen, $points)
$bitmap.Save((Join-Path $assetDirectory 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$pen.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$fixture = [System.Drawing.Bitmap]::new(700, 450)
$canvas = [System.Drawing.Graphics]::FromImage($fixture)
$canvas.Clear([System.Drawing.Color]::White)
$font = [System.Drawing.Font]::new('Arial', 46)
$smallFont = [System.Drawing.Font]::new('Arial', 16)
$canvas.DrawString('SYNTHETIC TEST MONITOR', $smallFont, [System.Drawing.Brushes]::Gray, 35, 20)
$canvas.DrawString('SYS   128 mmHg', $font, [System.Drawing.Brushes]::Black, 35, 85)
$canvas.DrawString('DIA     82 mmHg', $font, [System.Drawing.Brushes]::Black, 35, 190)
$canvas.DrawString('PUL    73 /min', $font, [System.Drawing.Brushes]::Black, 35, 295)
$fixture.Save((Join-Path $artifactDirectory 'synthetic-monitor.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()
$font.Dispose()
$smallFont.Dispose()
$fixture.Dispose()
