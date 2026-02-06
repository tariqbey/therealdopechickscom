

# Video Player with VR 180/360 Support

## Overview
Add a versatile video player component that handles three video modes:
- **Standard video** -- regular flat video playback
- **360 video** -- full spherical panoramic video (equirectangular)
- **VR 180 video** -- half-sphere stereoscopic 3D video (side-by-side)

The player will use **Three.js** with **@react-three/fiber** to render immersive video on a sphere geometry, with mouse/touch drag to look around in 360/VR180 modes.

## What You'll Get
- A dedicated `/player` page with the video player
- Standard HTML5 video controls for regular videos
- Click-and-drag to look around in 360 and VR180 modes
- A mode selector (Standard / 360 / VR180) so users or creators can pick the right format
- Fullscreen support
- Works on desktop and mobile (touch drag for mobile)

## Technical Details

### New Dependencies
- `three` (v0.133+) -- 3D rendering engine
- `@react-three/fiber` (v8.18) -- React wrapper for Three.js (v8 for React 18 compatibility)
- `@react-three/drei` (v9.122.0) -- Helper utilities

### New Files

1. **`src/components/VideoPlayer.tsx`**
   - Main component with three modes: `standard`, `360`, `vr180`
   - Standard mode: native HTML5 `<video>` element with controls
   - 360 mode: Three.js sphere with equirectangular video texture mapped to inside, camera at center, orbit controls for look-around
   - VR180 mode: Three.js half-sphere with side-by-side video mapped, showing left-eye view by default with orbit controls limited to front hemisphere
   - Props: `src` (video URL), `mode` (standard/360/vr180), `poster` (optional thumbnail)
   - Custom overlay controls: play/pause, fullscreen, mode switcher, progress bar

2. **`src/pages/VideoPlayerPage.tsx`**
   - Page wrapper with Navbar/Footer
   - Demo video sources with mode selector
   - Styled consistently with the rest of the app (dark theme, gradient cards)

### Modified Files

3. **`src/App.tsx`**
   - Add route: `/player` pointing to `VideoPlayerPage`

### How the 360/VR180 Rendering Works
- A `<video>` element is created off-screen and used as a `VideoTexture` in Three.js
- For 360: the texture is mapped to the inside of a full sphere (`SphereGeometry`) -- the camera sits at the center and the user drags to rotate the view
- For VR180: the texture UV is adjusted to show only the left half (left eye) on a half-sphere, with orbit controls constrained to the front 180 degrees
- `OrbitControls` from drei handles mouse/touch interaction with damping for smooth movement

