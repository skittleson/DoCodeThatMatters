> **AI;DR:** I wrote the first draft, AI helped me edit and rewrite it, and I made the final pass.

TLDR; Out of 8,809 Sony photos in my Immich library, only one burst was steady enough to merge cleanly. That changed what the app had to be. [Burst Super-Res](https://github.com/skittleson/burst-superres) is free and open source (MIT). It runs offline on macOS, Windows and Linux. [Download it here](https://github.com/skittleson/burst-superres/releases/latest).

[This is a web version](https://skittleson.github.io/burst-superres/) that can be used, but be mindful it is running in the browser. The desktop app is preferred and optimized for it.

**Sony A6000/A6400 series:** [Part 1: Modernization](/hacking-sony-a6000-for-modernization/) · [Part 2: More Hacks](/hacking-sony-a6000-more/) · [Part 3: Tethered Raspberry Pi](/sony-camera-part3/) · [Research & Community Resources](/sony-a6000-a6400-research/) · Burst Super-Res (this post)

![Burst Super-Res merging a real 8-shot Sony A6000 burst, with the before/after slider](/images/burst-superres/app-real-burst.webp "A real 8-shot A6000 burst. Left of the slider: one photo upscaled 2x. Right: the mean of all 8.")

## What it is

Drop in a burst of photos of the same still scene. The app lines them up to a fraction of a pixel and merges them. The result has twice the width and height. Four 6000 x 4000 photos become one 12000 x 8000 image. It reads JPEG, PNG and Sony ARW (RAW) and keeps your EXIF. A split slider shows what the merge did.

There is no AI in the processing. Every output pixel comes from pixels the camera recorded, averaged after alignment. AI upscalers invent detail that looks plausible. This only uses detail that is really there... which is also why the gain is small.

Expect less noise and cleaner fine edges. Do not expect 4x the detail. That's why the app never shows a megapixel number. On simulated bursts with a known answer the gain over one upscaled photo was **+0.7 to +1.3 dB <abbr title="Peak Signal-to-Noise Ratio: how close an image is to a reference, in decibels. Higher is better.">PSNR</abbr>**. Real but modest.

## Why build it

[Part 1 of the Sony series](/hacking-sony-a6000-for-modernization/) has a super-resolution trick. Shoot 4 photos, upscale each 200%, align them, blend two at 50%, then blend the two results. On paper that's (24.3 x 2) x 2 = 97.2 MP. In practice it looked more like 48.6 MP.

**Q:** Why not just use the script? **A:** Nobody wants to set up a Python environment to merge four photos. A download is easier.

## Rules first, then research

Here are the rules, set before any code was written.

- No AI in the processing. Every pixel has to come from the photos.
- Measure on real data and publish the numbers (including where a feature hurts).
- Cross platform without Electron. The app uses [tinyjs](https://tinyjs.app/), which runs the UI in the OS webview. The Linux build is about 10 MB.

Research drove the changes below. Each idea got measured against a benchmark before it went in.

### The benchmark

A real burst has no "true" high-resolution image to score against. So I made one. Take a real 24 MP A6000 or A6400 photo as the answer. Shift copies by random sub-pixel amounts. Downsample them 2x the way a sensor pixel averages light. Add noise and save as JPEG. Then merge them back and score against the original. The baseline is the same reference photo upscaled 2x with Lanczos-3, so both sides have the same output size.

First attempt at the benchmark was wrong and nothing looked off. The harness decoded with `jpeg-js`, which truncates instead of rounding. That shifted every pixel by -0.53 levels per round trip and skewed every score. Switching to libjpeg-turbo's `djpeg`/`cjpeg` fixed it. Every number in this post comes from that harness. Run it yourself with `npm run bench -- --gt your-photo.jpg`.

### The original method is just a mean

The pairwise 50/50 blend from Part 1 is a plain average with extra rounding. For 4 photos you blend A+B, blend C+D, then blend those two. Every photo ends up at 25%. That's a mean, rounded to 8 bits after each stage. For 3 photos it's worse (the weights come out 25/25/50).

The default became a per-pixel mean (or median) over all aligned photos. The weights are exact for any count. Pairwise is still in the app if you want to compare.

The bigger change was alignment. The Python version (v0) matched <abbr title="Scale-Invariant Feature Transform: finds distinctive points in each photo and matches them between photos.">SIFT</abbr> features and fit a homography. v0.1 uses sub-pixel registration instead. It builds an image pyramid, runs [Lucas-Kanade](https://en.wikipedia.org/wiki/Lucas%E2%80%93Kanade_method) on tiles, then fits an affine warp through the tile shifts. On simulated bursts it lands within 0.03 px, even rotated 0.5 degrees.

Shift-and-add got tried and dropped. It places every input pixel at its exact sub-pixel spot on the 2x grid. On synthetic test patterns with heavy aliasing it beat the mean by 1.0 to 1.7 dB. On real photos it tied the mean. On a detailed canyon crop it was 0.2 to 0.5 dB worse. Out it went.

### You need a tripod, don't forget it

v0.1 only had simulated bursts to show. So I went looking for real ones in Immich. It has 1,880 Sony photos from the A6400 and 6,929 from the A6000. Shots seconds apart with the same settings gave 732 burst candidates. I ran the app's own alignment over 348 of them.

302 were handheld and more than 10 px off. One was steady. It's a 13-shot A6000 canyon burst (`20231228_122526.JPG`, 20 mm, f/11, ISO 100), the photo at the top of this post. Even that one had 3 frames that didn't line up well enough for v0.1.

![One photo upscaled 2x next to 5 real photos merged](/images/burst-superres/before-after-real-burst.webp "200% crop: one photo upscaled vs 5 real frames merged. Less noise, fewer JPEG block edges.")

That's 302 of 348 bursts shot handheld (from someone who wrote a guide on this!). A tool that only works on a tripod is a tool for almost nobody.

### Borrowing from tools that already solved this

Here is how other tools handle it. These got checked before building more.

- [DeepSkyStacker](http://deepskystacker.free.fr/english/userguide.htm) scores every frame and stacks only the best ones. v0.1 warned about bad frames and made you untick them by hand.
- [Lightroom](https://www.schubertphotography.com/lightroom-before-after/) uses `\` to toggle before/after and `Y` for side by side. Photographers already know those keys.
- [Topaz Gigapixel](https://docs.topazlabs.com/topaz-gigapixel/functions/compare) compares results with one shared navigator.
- [Sony's own pixel-shift workflow](https://support.d-imaging.sony.co.jp/app/imagingedge/en/instruction/1_2_about_psm.php) gives you the shooting rules and the wait time up front.
- Google's [Handheld Multi-Frame Super-Resolution](https://arxiv.org/abs/1905.03277) (Wronski et al., 2019) is the paper behind Pixel's Super Res Zoom. It treats hand tremor as the *source* of the useful sub-pixel shifts. The catch is that each region needs its own alignment.

That last one changed the plan. v0.2 added local alignment. When the global fit is worse than 0.1 px, a grid of 64 px cells gets measured and corrected on top of it. Take a real handheld pair where the camera moved 52 px. The near cactus and the far hills shifted by different amounts. The error went from 4.36 px (a doubled cactus) to 0.06 px. All 8 canyon frames came in at 0.22 px or better.

![The same handheld pair merged with one shift and rotation, and with local alignment](/images/burst-superres/handheld-affine-vs-local.webp "Left: one shift and rotation for the whole photo, 4.36 px off. Right: local alignment, 0.06 px.")

v0.2 also added the Lightroom keys and a Good/Soft/Too far off badge per photo. Bad frames get unticked for you. Any 64 px area where something moved (water, leaves, people) is left out of that photo so it doesn't ghost. When a burst is too far gone the app says so.

![The app warning that a soft photo is used and part of it was left out](/images/burst-superres/app-handheld-warning.webp "Two handheld shots 4 s apart, about 370 px of movement. The app uses the photo but says it's soft.")

### What the papers said, and what measured better

Next came the research on alignment and stacking. I measured the cheap ideas before adopting any of them.

| Method (4-frame simulated burst) | A6000 canyon photo | A6400 photo (mostly out of focus) |
|---|---|---|
| One photo upscaled 2x | 33.51 dB | 38.60 dB |
| Mean merge | 34.58 dB | 39.84 dB |
| Mean + gentle deblur | 35.54 dB | 39.79 dB |
| Sigma-clipped mean | 34.48-34.54 dB | 39.77-39.82 dB |
| Deblur on one photo alone | 32.69 dB | 37.56 dB |

Deblurring only helps *after* the merge. On a single photo it made things worse. That matches the two-step approach in Farsiu et al., [Fast and Robust Multiframe Super Resolution](https://people.duke.edu/~sf59/srfinal.pdf) (2004). Stacking lowers the noise enough for deconvolution to work. Sigma clipping is the astro stacking staple from [Siril](https://free-astro.org/siril_doc-en/co/Average_Stacking_With_Rejection__1.html). It didn't help here because the per-area masking already takes care of moving things.

That turned into three features in v0.3.

**Sharpening after the merge.** It's a gentle Richardson-Lucy deconvolution. (Clarkvision compares it against unsharp masking on real photos: [part 1](https://www.clarkvision.com/articles/image-restoration1/), [part 2](https://www.clarkvision.com/articles/image-restoration2/).) "Auto" leaves one photo out of the merge and picks the amount that predicts that photo best. It's off by default for camera JPEGs. They're already sharpened in camera and Auto measured up to 0.9 dB worse on those.

**Brightness matching.** Exposure flicker gets measured per photo and colour, then evened out. With ±5% simulated flicker it recovered the true gains to within 0.001.

**RAW (Sony ARW).** Wronski's point is that a camera JPEG already threw away the fine aliasing detail super-resolution needs. With 6 or more ARW files, every output pixel is built from the raw sensor samples of all the photos. There's no demosaicing in between. The ARW decoder is written from scratch in JavaScript. It matches [LibRaw](https://www.libraw.org/) on all 24.2 million samples of a real A6000 file. In simulations RAW scored 0.9 to 2.5 dB better than the same burst as JPEGs.

![6 camera-style JPEGs merged next to the same 6 RAW files merged from sensor samples](/images/burst-superres/raw-vs-jpeg.webp "Simulated 6-photo burst: merged as camera JPEGs vs merged from RAW sensor samples.")

I have one real ARW to test with and no real RAW burst. So every RAW quality number above is from simulated bursts.

Deep-learning burst super-resolution tops the benchmarks. See [Deep Burst Super-Resolution](https://arxiv.org/abs/2101.10997) (Bhat et al., 2021) and [Burstormer](https://arxiv.org/abs/2304.01194) (2023). It also invents detail and needs a big model or a GPU, which breaks the first rule. Want more on the classical side? The IPOL re-implementation of Google's method ([Lafenêtre, Facciolo, Eboli, 2023](https://www.ipol.im/pub/art/2023/460/article_lr.pdf)) walks through every step with its own measurements. [CANDID](https://arxiv.org/abs/2306.09887) covers optical-flow alignment for scenes with a lot of depth.

### Where the pixel work runs

tinyjs apps have two halves. There's a [txiki.js](https://github.com/saghul/txiki.js) backend and the OS webview (WebKitGTK, WKWebView or WebView2). The backend runs QuickJS with no JIT. A tight loop over 96 MB of pixels per photo is exactly where a JIT matters. So all the math runs in the page in Web Workers. The backend only writes the output file.

One gotcha... Chromium (which WebView2 uses) blocks workers loaded from `file://` URLs. The worker gets built from function source as a Blob URL instead. The output goes back to the backend in 3 MB base64 chunks because the bridge is text.

The latest change spreads alignment and merging over a pool of helper workers. Four real 24 MP JPEGs went from 31.5 s to 14.1 s on a 24-core machine. The output matches the single-threaded version pixel for pixel. That shipped in v0.4.0 along with EXIF in PNG output.

### Shipping it

GitHub Actions builds every platform from a tag, plus Linux AppImages. Every release file has a [GitHub build attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations). The checksum file and AppImages are GPG-signed. Check your download with:

```sh
gh attestation verify burst-superres-0.4.0-linux-x86_64.AppImage -R skittleson/burst-superres
gpg --import signing-key.asc
gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
```

## What's left

It has only been tested on Linux. The macOS, Windows and Linux ARM64 builds come out of CI and nobody has launched them yet. Try one and [open an issue](https://github.com/skittleson/burst-superres/issues) if it breaks.