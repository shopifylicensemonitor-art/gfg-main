const sharp = require('sharp');
const fs = require('fs');

async function optimize() {
    try {
        // 1. Create a tiny WebP for the header
        await sharp('public/logo.png')
            .resize({ height: 128 }) // 128px height is plenty for retina displays (header is ~32px)
            .webp({ quality: 80 })
            .toFile('public/logo-sm.webp');
        console.log('Created public/logo-sm.webp successfully');

        // 2. We can also optimize the main logo to a lower file size if it's 550KB
        // But since it's already in public, we can just replace it with an optimized PNG
        await sharp('public/logo.png')
            .resize({ width: 512, height: 512, fit: 'contain' })
            .png({ compressionLevel: 9, quality: 80, palette: true })
            .toFile('public/logo-optimized.png');

        // Replace original logo.png with the optimized version to save PWA loading time
        fs.renameSync('public/logo-optimized.png', 'public/logo.png');
        console.log('Optimized public/logo.png successfully');
    } catch (err) {
        console.error('Error optimizing logos:', err);
    }
}

optimize();
