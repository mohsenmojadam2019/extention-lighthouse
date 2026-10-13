Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$target = Join-Path $root 'extension\icons'
New-Item -ItemType Directory -Force $target | Out-Null
foreach ($size in @(16, 48, 128)) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $bg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(10, 27, 46))
    $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(45, 215, 238), [Math]::Max(1, $size * .035))
    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(229, 247, 255))
    $cyan = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(42, 222, 236), [Math]::Max(2, $size * .12))
    $gold = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(250, 194, 85))
    $margin = [Math]::Max(1, [int]($size*.06))
    $g.FillEllipse($bg, $margin, $margin, $size-2*$margin, $size-2*$margin)
    $g.DrawEllipse($border, $margin, $margin, $size-2*$margin, $size-2*$margin)
    $g.DrawArc($cyan, [int]($size*.25), [int]($size*.25), [int]($size*.5), [int]($size*.5), 20, 240)
    $g.FillEllipse($gold, [int]($size*.66), [int]($size*.64), [Math]::Max(2, [int]($size*.10)), [Math]::Max(2, [int]($size*.10)))
    $bmp.Save((Join-Path $target ($size.ToString()+'.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $bg.Dispose(); $border.Dispose(); $white.Dispose(); $cyan.Dispose(); $gold.Dispose()
}
Write-Output 'Icons created: 16 48 128'