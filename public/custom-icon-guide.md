# How to Add Your Custom Icon

## Step 1: Prepare Your Image
Take your uploaded picture and create these versions:

1. **favicon.png** - 32x32 pixels (for browser tabs)
2. **apple-touch-icon.png** - 180x180 pixels (for iOS devices)
3. **icon.png** - 192x192 pixels (for PWA)
4. **icon-512.png** - 512x512 pixels (for high-resolution displays)

## Step 2: Save the Files
Place these PNG files in your `public/` folder:
```
c:\Users\hp\Downloads\project (1)\public\
├── favicon.png (32x32)
├── apple-touch-icon.png (180x180)
├── icon.png (192x192)
└── icon-512.png (512x512)
```

## Step 3: Restart the Server
After adding your images, restart your development server:
```bash
npm run dev
```

## Step 4: Verify
- Check browser tab for your custom favicon
- Test on mobile devices for Apple touch icon
- Verify PWA installation shows your icon

## Tips:
- Use a square image for best results
- Keep it simple and recognizable at small sizes
- High contrast works better for visibility
- Test on different devices and browsers

Your custom image will now be the system icon! 🚛
