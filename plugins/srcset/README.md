# underdot-srcset

Gives [Underdot](https://github.com/Lab43/underdot#readme) templates a helper that renders an image with a `srcset`, and has the build produce the resized copies it names.
<!-- source: q-docs/specs/srcset.md -->

## Install

```sh
npm install underdot-srcset
```

```ts
import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { srcset } from 'underdot-srcset';

export default {
  plugins: [
    ejs(),
    srcset({
      presets: {
        hero: { sizes: '(min-width: 600px) 600px, 100vw', widths: [300, 600, 1200] },
      },
    }),
  ],
} satisfies Configuration;
```

## The helper
<!-- source: q-docs/specs/srcset.md, The helper -->
<!-- source: q-docs/specs/srcset.md, Derivatives -->

`imageSet(reference, sizing, attributes)` returns one `<img>` carrying `src`, `srcset`, and `sizes`, then the given attributes:

```ejs
<%- imageSet('/_photos/team.jpg', 'hero', { alt: 'The team' }) %>
```

- The sizing is a preset's name, or a sizing written in the call for a one-off image.
- Each width below the image's own width becomes a resized copy at `<name>-<width>.<extension>`, beside the original.
- A width the image cannot fill is skipped, and the image's own width is the largest candidate.
- An original under an underscore is never written, so it ships as its resized copies alone, at paths without the underscore.
- An attribute whose value is `false` is left out.

The image is a JPEG, PNG, WebP, GIF, or AVIF. Resized copies are made with [sharp](https://sharp.pixelplumbing.com), stripped of their metadata, and made again only when the original or the sizing changes.

## Options
<!-- source: q-docs/specs/srcset.md, Options -->

- `presets`: sizings by name. A sizing is `{ sizes, widths, webp }`:
  - `sizes`: the element's `sizes` attribute.
  - `widths`: the widths to offer, a non-empty list of positive integers.
  - `webp`: whether the resized copies are converted to WebP. Defaults to `true`. With `false`, they keep the original's format.

[`q-docs/specs/srcset.md`](https://github.com/Lab43/underdot/blob/main/q-docs/specs/srcset.md) holds every rule the plugin commits to.
