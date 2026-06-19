# Builder Reference Image Generation

Specification for using existing story character images as visual references when generating new book images in the builder.

## Goal

When a page or cover includes known characters with existing images, the builder should send those images to OpenAI as references so generated illustrations preserve character identity, clothing, colors, proportions, and recurring visual details across the book.

## Current State

- The builder image model default is `gpt-image-2` in `apps/builder/src/lib/ai.ts`.
- Current image generation uses `openai.images.generate`, which is text-only and does not send reference images.
- Generated images are saved locally under the builder public assets path and stored in the book/page image URL fields.
- Page data already links characters through `page.characterIds`, and each character can have an `imageUrl`.

## Required Behavior

- If a generated asset has no usable reference images, keep the existing text-to-image path with `images.generate`.
- If reference images are available, use OpenAI image editing with `images.edit` and `model: "gpt-image-2"`.
- Reference images should come from:
  - page characters selected by `page.characterIds`;
  - cover characters when the cover prompt or book context clearly references them, if a future cover-character selection exists;
  - optionally, previously generated canonical character images once those are promoted to first-class assets.
- The final prompt must still include the existing implicit rules, starting with `NO TEXTS` and `NO TITLES`.
- The prompt must tell the model how to use references:
  - use reference images for character identity, clothing, colors, proportions, and continuity;
  - create a new scene from the page prompt;
  - do not copy image backgrounds unless explicitly requested;
  - keep all referenced characters in the same storybook illustration style.

## OpenAI API Strategy

Use `images.edit` when references exist:

```ts
const response = await openai.images.edit({
  model: "gpt-image-2",
  image: referenceFiles,
  prompt: finalPrompt,
  size,
  quality,
  output_format,
  background: "opaque",
});
```

Implementation notes:

- Convert local/public/data/remote image URLs into `File` inputs accepted by the OpenAI SDK.
- For local generated assets, read from the builder public directory.
- For remote URLs, download server-side and preserve MIME type when possible.
- For `data:` URLs, decode base64 directly.
- Keep `images.generate` as the fallback for text-only generation.
- Streaming partial images may only remain available for text-only generation unless `images.edit` supports equivalent streaming in the SDK/API version being used at implementation time.

## Builder Integration

Add reference-aware inputs to the image generation layer:

```ts
type ImageReference = {
  id: string;
  label: string;
  imageUrl: string;
};

type GenerateImageInput = {
  prompt: string;
  references?: ImageReference[];
};
```

Expected call sites:

- Page image generation:
  - collect references from `book.characters` where `page.characterIds` contains the character id and `character.imageUrl` is non-empty;
  - generate with references when at least one valid image exists.
- Cover image generation:
  - initially keep text-only unless cover-specific character selection is added;
  - later support explicit cover references.
- Character image generation:
  - remains text-only unless generating variants from an existing character image.

## Prompt Shape

Reference-aware page prompt should be assembled as:

```text
Implicit rules:
- NO TEXTS
- NO TITLES

Use the provided reference images only to preserve character identity, clothing, colors, proportions, and visual continuity.
Create a new storybook illustration for this scene.
Do not copy the reference backgrounds unless the prompt explicitly asks for them.
Keep every referenced character consistent with the references while matching the book's illustration style.

Book style:
...

Character continuity:
...

Scene:
...
```

## Data Persistence

- Store only the generated final image URL in the existing `coverImageUrl` or `page.imageUrl`.
- Do not store OpenAI input reference payloads in the database.
- Keep character image URLs as normal builder character data.
- When a generated image is returned as base64, save it locally through the existing generated asset path.
- Later R2 upload should treat reference-generated images the same as current generated images.

## Error Handling

- If a reference image cannot be loaded, skip that reference and continue if at least one usable reference remains.
- If all references fail to load, fall back to text-only generation and surface a non-blocking warning in the builder UI.
- If `images.edit` fails, show the failure on that individual image request, not globally for the whole book.
- Do not block text editing or other image generations while one reference-based generation is running.

## Acceptance Criteria

- Page image generation uses `images.edit` with `gpt-image-2` when selected page characters have valid image URLs.
- Page image generation falls back to `images.generate` when no references are available.
- Existing prompt values from the form are preserved and used.
- Existing implicit prompt rules are still prepended to every image request.
- Generated reference-based images are saved locally and served by the builder, not stored as `data:` URLs.
- The book payload continues to store generated image URLs in the existing fields.
- Individual image loading/error states continue to work per image.

## Official References

- OpenAI image generation guide: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI Images API reference: https://developers.openai.com/api/reference/resources/images
