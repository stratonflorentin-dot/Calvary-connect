Add-Type -AssemblyName System.Drawing

$publicDir = "c:\my projects\fleet management\public"

$bgColor = [System.Drawing.Color]::FromArgb(255, 41, 82, 163)   # #2952A3
$accentColor = [System.Drawing.Color]::FromArgb(255, 82, 202, 224) # #52CAE0
$wheelColor = [System.Drawing.Color]::FromArgb(255, 26, 58, 107)  # #1a3a6b
$whiteColor = [System.Drawing.Color]::White

function Draw-Icon {
    param([int]$size, [string]$filename)

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Background rounded rect
    $radius = [int]($size * 0.18)
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    
    # Draw rounded background
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $radius*2, $radius*2, 180, 90)
    $path.AddArc($size - $radius*2, 0, $radius*2, $radius*2, 270, 90)
    $path.AddArc($size - $radius*2, $size - $radius*2, $radius*2, $radius*2, 0, 90)
    $path.AddArc(0, $size - $radius*2, $radius*2, $radius*2, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bgBrush, $path)

    if ($size -le 48) {
        # Small icon: "CC" text
        $font = New-Object System.Drawing.Font("Arial", [float]($size * 0.5), [System.Drawing.FontStyle]::Bold)
        $brush = New-Object System.Drawing.SolidBrush($whiteColor)
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString("CC", $font, $brush, [System.Drawing.RectangleF]::FromLTRB(0, 0, $size, $size), $sf)
    } else {
        $pad = [int]($size * 0.11)
        $truckY = [int]($size * 0.26)
        $truckH = [int]($size * 0.28)
        $truckW = [int]($size * 0.44)

        # Trailer body
        $wBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(242, 255, 255, 255))
        $g.FillRectangle($wBrush, $pad, ($truckY + [int]($size * 0.05)), $truckW, $truckH)

        # Stripe on trailer
        $aBrush = New-Object System.Drawing.SolidBrush($accentColor)
        $g.FillRectangle($aBrush, $pad, ($truckY + [int]($size * 0.12)), $truckW, [int]($size * 0.04))

        # Cab
        $cabX = $pad + $truckW + [int]($size * 0.01)
        $cabY = $truckY - [int]($size * 0.04)
        $cabW = [int]($size * 0.24)
        $cabH = $truckH + [int]($size * 0.09)
        $g.FillRectangle($wBrush, $cabX, $cabY, $cabW, $cabH)

        # Windshield
        $wsX = $cabX + [int]($size * 0.025)
        $wsY = $cabY + [int]($size * 0.04)
        $wsW = $cabW - [int]($size * 0.05)
        $wsH = [int]($size * 0.11)
        $g.FillRectangle($aBrush, $wsX, $wsY, $wsW, $wsH)

        # Wheels
        $wheelY = $truckY + $truckH + [int]($size * 0.09)
        $wheelR = [int]($size * 0.07)
        $wheels = @(
            ($pad + [int]($truckW * 0.18)),
            ($pad + [int]($truckW * 0.65)),
            ($cabX + [int]($cabW * 0.5))
        )
        foreach ($wx in $wheels) {
            $wlBrush = New-Object System.Drawing.SolidBrush($wheelColor)
            $g.FillEllipse($wlBrush, ($wx - $wheelR), ($wheelY - $wheelR), ($wheelR * 2), ($wheelR * 2))
            $hlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 255, 255, 255))
            $innerR = [int]($wheelR * 0.60)
            $g.FillEllipse($hlBrush, ($wx - $innerR), ($wheelY - $innerR), ($innerR * 2), ($innerR * 2))
            $hubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(153, 255, 255, 255))
            $hubR = [int]($wheelR * 0.28)
            $g.FillEllipse($hubBrush, ($wx - $hubR), ($wheelY - $hubR), ($hubR * 2), ($hubR * 2))
        }

        # "CALVARY" text
        $fontSize = [float]([Math]::Max(8, $size * 0.085))
        $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
        $tBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(224, 255, 255, 255))
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Far
        $g.DrawString("CALVARY", $font, $tBrush, [System.Drawing.RectangleF]::FromLTRB(0, 0, $size, ($size - [int]($size * 0.03))), $sf)
    }

    $g.Dispose()
    $outPath = Join-Path $publicDir $filename
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $filename ($size x $size)"
}

# Generate all sizes
Draw-Icon 32  "favicon.png"
Draw-Icon 72  "icon-72.png"
Draw-Icon 96  "icon-96.png"
Draw-Icon 128 "icon-128.png"
Draw-Icon 144 "icon-144.png"
Draw-Icon 180 "apple-touch-icon.png"
Draw-Icon 192 "icon.png"
Draw-Icon 384 "icon-384.png"
Draw-Icon 512 "icon-512.png"

Write-Host "`n All icons generated successfully!"
