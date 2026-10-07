# Srcset

What the srcset plugin commits to: the one helper that renders an image with a `srcset`, the derivatives it has the build produce, and the one option the plugin takes. The plugin is a helper that emits files under the plugin contract (see: docs/specs/plugins.md, Template helpers) (see: docs/specs/plugins.md, Emitted files), and this spec holds what it adds to that contract.

## The plugin

The plugin is named `srcset` and registers one helper, `imageSet`. Rationale: `srcset` names the attribute the element carries, and `img` is general enough to collide with a site's own variables.

## The helper

A page or template calls `imageSet(reference, preset, attributes)`. The reference names a static file's output and resolves as a read through the render context does (see: docs/specs/templates.md, Relative paths). The preset is the name of a configured preset, or a preset written inline (see: Options). The attributes are an object, and default to none.

The helper returns one `<img>` element. It carries `src`, `srcset`, and `sizes` first, then the given attributes in the order given. An attribute whose value is `false` is omitted. Every value is escaped: `&`, `"`, `<`, and `>`. Rationale: a conditional attribute is awkward to spread in a template, so `false` drops it, and a value is the author's text, which the element must not let close the attribute.

The candidates are the image's width and the preset's widths, read this way:

- The image's width is the one it displays at: a JPEG's EXIF orientation is applied, so an image stored landscape and tagged to stand upright is measured by its upright width. Rationale: a phone's portrait photo is stored landscape, and the width a browser lays out is the oriented one.
- Each requested width below the image's width is a derivative at `<base>-<width>.<extension>`.
- When any requested width is the image's width or more, the image's own width stands in for every such width as the largest candidate. Rationale: a `w` descriptor states the resource's width, an enlarged image states one at a cost of bytes, and a 4000-pixel original offered to a browser told 1600 is the most it needs was never asked for.
- A width the image cannot fill is skipped and never an error. Rationale: a site's presets may outrun some of its images.
- Requested widths are offered once each, in ascending order.

`src` is the largest candidate's URL, and every URL is the output path with a leading slash.

The derivatives' paths keep the original's directory:

- The base is the output path with one leading underscore removed from each segment that has one, and the extension removed.
- The extension is `webp` when the preset converts, and otherwise the original's own.
- The largest candidate is the original itself when its path has no underscore-prefixed segment and the preset keeps its format. Otherwise it is a derivative at `<base>.<extension>`, at the image's width.

Rationale: the underscore gives the author a per-image choice with no option. A public original is copied as it is and serves as the largest candidate. A private one is never written (see: docs/specs/source-tree.md, Underscore prefix) and ships as derivatives alone, at public paths, which is where a large camera file gets recompressed. A converting preset gets a full-size derivative even for a public original, since the original cannot serve as WebP.

A WebP original is never converted, since it is WebP already, so it is treated as under a preset that keeps its format. Rationale: converting it would emit its full-size derivative at its own path, a collision with the copied original.

These calls are errors:

- A reference that is not a string.
- A preset that is neither a name nor an object.
- A name no configured preset has.
- An inline preset that fails the check a configured one does (see: Options).
- Attributes that are not an object.
- Attributes carrying `src`, `srcset`, or `sizes`. Rationale: the element sets them itself.
- An attribute value that is neither a string nor `false`.
- A reference at which no static file's output is.
- Bytes the helper cannot read an image's size from, with the reader's message.
- An image that is not a JPEG, PNG, WebP, GIF, or AVIF. Rationale: an SVG has a size the helper can read, and resizing it would put a raster image at an `.svg` path.

## Derivatives

Each derivative is sharp's output for the original's bytes at its width:

- A JPEG's EXIF orientation is applied, and no other format's. Rationale: the width the helper measured is the oriented one only for a JPEG, and a derivative must have the width its descriptor states. A PNG or WebP carrying an orientation tag is a rarity no camera makes.
- Its metadata is stripped, EXIF and the color profile included.
- It is WebP unless the preset keeps the original's format.
- Every other encoding setting, quality included, is sharp's default.

A derivative is produced through the build's emit, so it is produced again only when the original's bytes or the derivative's width or format changed (see: docs/specs/plugins.md, Emitted files). A sharp upgrade changes every derivative once. Rationale: a derivative is a function of the original's bytes, the width, the format, and the sharp version, so every machine on one lockfile writes the same derivative.

A derivative of a GIF or AVIF original under a preset that keeps its format is exempt from byte-identity across machines (see: docs/specs/build.md, Determinism). Rationale: sharp encodes those formats differently on different machines. One machine still writes the same bytes on every run, so reuse is unaffected, and the cost is a committed destination's diff and a deploy's caches showing those files changed when a second machine builds. A preset stays usable for every source type rather than failing on these two. AVIF is never an output format: its bytes at sharp's default effort differ by machine and by thread count, and its one deterministic effort costs fifty times a WebP encode.

## Options

The factory takes one option, `presets`, an object of presets by name. A preset is `{ sizes, widths, webp }`:

- `sizes` is a string, the element's `sizes` attribute as it is.
- `widths` is a non-empty list of positive integers, the widths to offer.
- `webp` is `true` or `false`, and `true` when absent. A preset with `webp` true converts its derivatives to WebP, and one with `webp` false keeps the original's format.

Rationale: WebP decodes in every current browser, so a `srcset` of WebP needs no `<picture>` fallback, and a WebP derivative comes out about a third smaller than a JPEG at like quality. A site whose derivatives must keep their format, for a consumer that cannot read WebP, opts out once per preset. The switch sits on the preset because a hero and a thumbnail may differ, and because converting changes the derivative paths.

These are errors, raised when the configuration loads and before any file is handled:

- A `presets` value that is not an object.
- A preset that is not an object.
- A `sizes` that is not a string.
- A `widths` that is not a non-empty list of positive integers.
- A `webp` given that is not a boolean.

The factory takes no other option. Rationale: quality and sharp's other settings are levers no site has asked for, and a plugin-wide switch would change every image's paths at once.
