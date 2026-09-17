Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$bmp.SetResolution(96, 96)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded square background
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 56
$path.AddArc(0, 0, $r, $r, 180, 90)
$path.AddArc($size - $r, 0, $r, $r, 270, 90)
$path.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
$path.AddArc(0, $size - $r, $r, $r, 90, 90)
$path.CloseFigure()

$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 37, 99, 235), [System.Drawing.Color]::FromArgb(255, 30, 58, 138), 40)
$g.FillPath($brush, $path)

# Atom rings
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 255, 255), 11)
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

foreach ($deg in 0, 60, 120) {
  $g.ResetTransform()
  $g.TranslateTransform(128, 128)
  $g.RotateTransform($deg)
  $g.TranslateTransform(-128, -128)
  $g.DrawEllipse($pen, 52, 96, 152, 64)
}

# Electron dots on rings
$dot = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$dotPositions = @(
  @(-1, 0),   # left ring point
  @(1, 0),    # right ring point
  @(0, 1)     # bottom ring point
)
$i = 0
foreach ($dp in $dotPositions) {
  $dx = [int]((76 * $dp[0]) - 8)
  $dy = [int]((76 * $dp[1]) - 8)
  $g.ResetTransform()
  $g.FillEllipse($dot, 128 + $dx, 128 + $dy, 16, 16)
  $i++
}

# Nucleus
$nucleus = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 251, 191, 36))
$g.ResetTransform()
$g.FillEllipse($nucleus, 104, 104, 48, 48)

$out = Join-Path $PSScriptRoot '..\build\icon.png'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "saved $out"