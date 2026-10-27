# PixelKit — Free Online Image Tools

> Fast, private, mobile-first browser image tools to compress, resize, crop, convert, and enhance photos locally with zero server uploads.

PixelKit is built with **100% standard HTML, CSS, and vanilla JavaScript**. It requires zero Node.js server, zero paid APIs, zero backend databases, and zero build commands. It is engineered specifically for direct, zero-cost static hosting on **Cloudflare Pages Free** or GitHub Pages.

---

## 📱 Features Included

1. **Image Compressor**
   - Fine-tuned quality slider (5% to 100%).
   - Bounded **Target File Size mode** (e.g. compress down to 50 KB, 100 KB, or 200 KB for passport & application forms).
   - Multi-format output (JPEG, WebP, PNG).
   - Displays original size, output size, and genuine percentage reduction.

2. **Image Resizer**
   - Custom pixel width and height with aspect ratio lock/unlock.
   - Percentage presets (25%, 50%, 75%, 100%, 150%).
   - Common dimension presets (1080×1080 Square, 1080×1920 Story, 1280×720 YouTube, 1920×1080 Full HD, 600×600 Passport).

3. **Touch Cropper & Aspect Ratio Adjuster**
   - Interactive draggable crop area with 4 corner resize handles.
   - Touch directional nudge buttons (▲, ▼, ◀, ▶) for micro-adjustments on mobile screens.
   - Preset ratios: Free, 1:1 Square, 4:5 Portrait, 4:3 Standard, 16:9 Landscape, 9:16 Story.
   - Clamped strictly to source image boundaries; never exports out-of-bounds pixels.

4. **Image Format Converter**
   - Converts between WebP, JPEG, and PNG.
   - Background color picker for transparent PNGs converting to JPEG.
   - Verifies real browser Blob MIME type and assigns correct file extensions.

5. **Photo Enhancer**
   - Real-time Brightness, Contrast, Saturation, and Sharpness (3×3 unsharp convolution kernel).
   - High-performance low-resolution preview for smooth slider response on budget phones.
   - Full-resolution pixel baking on export.
   - One-tap quick styles (Auto Contrast, Vivid Color, Warm Sunlight, Monochrome B&W, Crisp Detail).

---

## 🔒 Privacy & Performance Guarantees

- **100% Client-Side Processing**: Images are processed directly inside your browser's RAM using the HTML5 Canvas API and Blob API. Photos are never uploaded to any server.
- **Strict Memory Safety**: Input file size is capped at 20 MB and maximum dimensions at 8192×8192 px to prevent Android mobile browsers from running out of memory.
- **Resource Cleanup**: All temporary Blob URLs are revoked immediately after use to prevent memory leaks during repeated sessions.

---

## 🚀 Beginner's Guide: Deploying to Cloudflare Pages for Free (From an Android Phone)

You can publish PixelKit to the internet for free without installing any software or owning a computer.

### Step 1: Create a Free GitHub Account
1. Open Google Chrome on your Android phone.
2. Go to [github.com](https://github.com) and tap **Sign up** (it is completely free).
3. Follow the prompts to create your account and verify your email.

### Step 2: Create a New GitHub Repository
1. In mobile Chrome, go to [github.com/new](https://github.com/new).
2. For **Repository name**, enter: `pixelkit`.
3. Choose **Public**.
4. Check **Add a README file**.
5. Tap the green **Create repository** button.

### Step 3: Add the Project Files to Your Repository
1. In your new repository on GitHub, tap the **Add file** button and select **Upload files**.
2. Upload the core static files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `tools.js`
   - `image-utils.js`
   - `favicon.svg`
   - `robots.txt`
   - `sitemap.xml`
   - `README.md`
3. Tap **Commit changes**.

### Step 4: Create a Free Cloudflare Account
1. Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Enter your email and password to create a free account. Cloudflare does not require a credit card for the Free Pages tier.

### Step 5: Connect Cloudflare Pages to Your GitHub Repository
1. In the Cloudflare dashboard, tap the menu (top left) and select **Workers & Pages**.
2. Tap **Create Application**, then choose the **Pages** tab.
3. Tap **Connect to Git** and authorize your GitHub account.
4. Select the `pixelkit` repository from your list.

### Step 6: Select Static Deployment Settings (CRITICAL)
In the deployment setup screen, set the following:
- **Project name**: `pixelkit` (or any name you like)
- **Production branch**: `main`
- **Framework preset**: `None`
- **Build command**: Leave completely **EMPTY** (do NOT enter any command)
- **Build output directory**: Leave as `/` (root directory containing `index.html`)

### Step 7: Tap "Save and Deploy"
1. Tap the green **Save and Deploy** button.
2. Cloudflare will copy the static files in about 10–20 seconds.
3. You will see a green checkmark and your live URL (e.g. `https://pixelkit.pages.dev`).

### Step 8: Test Your Live Site on Android Chrome
1. Tap the live link to open your website.
2. Tap the upload area to pick a photo from your Android camera roll.
3. Test compressing, resizing, cropping, converting, and downloading.
4. The downloaded file will appear instantly in your phone's **Downloads** and Google Photos gallery.

---

## 🔄 How to Update Your Website in the Future
Whenever you edit a file on GitHub (for example, tweaking text in `index.html` or CSS styles in `styles.css`), Cloudflare Pages will automatically detect the commit and publish the update to your live website within seconds.

---

## ⚖️ Cloudflare Pages Free Tier Limits (Honest & Transparent)
- **Bandwidth**: Unlimited.
- **Sites / Projects**: Unlimited.
- **Static Deployments**: Up to 500 builds per month (more than enough for a personal or small business project).
- **Custom Domains**: 100% free (you can connect your own `.com` or `.net` domain later if you buy one, or keep the free `*.pages.dev` domain forever).
