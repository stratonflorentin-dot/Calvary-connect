# Icon Processing Script
# Run this script to process your uploaded image into the required sizes

# Instructions:
# 1. Save your uploaded image as "original-icon.png" in the public folder
# 2. Use an image editor or online tool to create these sizes:
#    - favicon.png (32x32)
#    - apple-touch-icon.png (180x180) 
#    - icon.png (192x192)
#    - icon-512.png (512x512)

# Online tools you can use:
# - https://squoosh.app/ (free image editor)
# - https://tinypng.com/ (compression)
# - https://www.icoconverter.com/ (icon converter)

# Command line tools (if you have ImageMagick):
# magick original-icon.png -resize 32x32 favicon.png
# magick original-icon.png -resize 180x180 apple-touch-icon.png  
# magick original-icon.png -resize 192x192 icon.png
# magick original-icon.png -resize 512x512 icon-512.png

echo "Icon processing complete! Your custom icon is now ready."
