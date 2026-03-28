@echo off
echo 🚛 FleetCommand Icon Processor
echo ==============================
echo.
echo This script will help you convert your custom image to all required icon sizes.
echo.
echo STEPS:
echo 1. Place your custom image as "original-icon.png" in this folder
echo 2. Open icon-converter.html in your browser
echo 3. Upload your image and download all sizes
echo 4. Copy the downloaded files to replace the placeholders
echo.
echo Files needed:
echo - favicon.png (32x32)
echo - apple-touch-icon.png (180x180)
echo - icon.png (192x192)
echo - icon-512.png (512x512)
echo.
echo Opening icon converter tool...
start icon-converter.html
echo.
echo After downloading your icons, restart your development server to see changes!
pause
