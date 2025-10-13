---
title: "sfx: A Shader Playground"
layout: post
tags: [shaders, webgl, threejs, react, typescript]
---

I was working on a WebGL project that needed a water shader, and I wanted to see results immediately as I tweaked the GLSL. Tools like Shadertoy, glsl.app, and The Book of Shaders' editor exist, but they force you to use online editors and require accounts to save your work.

So I built **sfx** — a personal shader playground that lets me experiment with GLSL offline using tools I'm familiar with, keep a library of effects I can reference later, and share them easily.

{% include callout.html
    content ="At the time of writing (Oct. 10 '25), Shadertoy is experiencing issues loading anything beyond the homepage, another sign that I should maintain permanent access to and control over my work."
    type="warning" %}

![A water shader experiment running in the browser]({{ site.baseurl }}/images/posts/2025-10-13-sfx-shader-playground/water-shader.gif)

You can check it out live at [tessapower.xyz/sfx](https://tessapower.xyz/sfx/).

<!--more-->

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Deployment](#deployment)
- [What's Next?](#whats-next)

## What It Does

sfx is pretty straightforward: it renders fragment shaders on a fullscreen canvas with automatic hot reloading. Drop a `.glsl` file in the `shaders/` directory, save it, and it appears in the dropdown immediately. No build step and no manual imports!

Every shader gets access to standard uniforms:

- `u_time` - elapsed time in seconds
- `u_resolution` - canvas dimensions
- `v_uv` - UV coordinates (0-1 range)

The shared vertex shader handles the basics, so you can focus entirely on the fragment shader.

## Tech Stack

The stack is intentionally minimal:

- **[Vite](https://vitejs.dev/)** for dev server and hot module reloading
- **[React](https://react.dev/)** for component structure
- **[TypeScript](https://www.typescriptlang.org/)** for type safety
- **[Three.js](https://threejs.org/)** for WebGL rendering
- **[lil-gui](https://lil-gui.georgealways.com/)** for the shader selection dropdown

The interesting bit is how shader discovery works. Vite's `import.meta.glob` scans the `shaders/` directory at build time and generates dynamic imports. Each subdirectory becomes a shader program — simply add a `fragment.glsl` file with your shader code and it's automatically available:

```bash
shaders/
  ├── plasma/
  │   └── fragment.glsl
  ├── circles/
  │   └── fragment.glsl
  └── gradient/
      └── fragment.glsl
```

The `ShaderLoader` utility reads these paths, extracts the shader names, and loads the GLSL as raw text. When you select a shader from the dropdown, Three.js compiles it into a `ShaderMaterial` and applies it to a fullscreen quad.

One quirk I ran into was React's hot module reloading trying to reuse the same canvas element, which caused WebGL context conflicts. The fix was creating a fresh canvas element on each component mount — a bit unconventional for React, but necessary to avoid the "existing context of a different type" error.

## Deployment

The deployment setup is minimal. GitHub Actions builds the Vite project and deploys to GitHub Pages:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: ['main']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

The critical bit for subdirectory hosting is setting the base path in `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/sfx/',
  // ...
})
```

Without this, Vite generates asset paths relative to the domain root, which breaks when deployed to a subdirectory. With the base path set, assets load correctly at `tessapower.xyz/sfx/`.

## What's Next?

Right now sfx is exactly what I need — a quick way to prototype shaders without friction, build up a library of effects I can reference, and share them easily. A few things I might add:

- Shader uniforms editable via lil-gui sliders
- Mouse position as a uniform for interactive effects
- Texture loading support
- Export rendered frames as images

But honestly, the simplicity is the point. It does one thing well: lets me write shaders in my own environment and see them immediately, both locally and deployed.

---

{% include callout.html
    content ="Check out the [repo on GitHub](https://github.com/tessapower/sfx), and play with sfx at [tessapower.xyz/sfx](https://tessapower.xyz/sfx/)!"
    type="primary" %}
