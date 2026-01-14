# Avatar Image Processing

This document describes the workflow used to convert raw AI-generated pixel art images into optimized, consistent avatar assets for the May I? card game.

## Overview

The avatars are inspired by characters from **Hoyle Card Games 2002** by Sierra On-Line. Raw images were generated as pixel art PNGs, then processed into optimized SVGs and PNGs with transparent backgrounds and consistent square dimensions.

## Directory Structure

```
public/
├── raw_avatars/     # Original AI-generated PNGs (source files)
│   ├── bart.png
│   ├── elayne.png
│   ├── ethel.png
│   ├── jasper.png
│   ├── langley.png
│   ├── maurice.png
│   ├── primus.png
│   └── robin.png
│
└── avatars/         # Processed, optimized assets (production)
    ├── bart.svg
    ├── bart.png
    ├── elayne.svg
    ├── elayne.png
    └── ... (8 characters × 2 formats)
```

## Processing Pipeline

### Step 1: Source Images

Raw images were AI-generated pixel art portraits at various dimensions (960×1088 to 1120×928). Each had a light gray/white background (#FEFEFE or similar).

### Step 2: Convert to SVG with VTracer

[VTracer](https://github.com/visioncortex/vtracer) converts raster images to vector graphics. Unlike Potrace (black & white only), VTracer handles full-color images.

**Installation:**
```bash
# Via Cargo (requires Rust)
cargo install vtracer
```

**Conversion command with optimized settings:**
```bash
vtracer \
  --input image.png \
  --output output.svg \
  --colormode color \
  --hierarchical stacked \
  --filter_speckle 4 \
  --color_precision 6 \
  --gradient_step 16 \
  --mode spline \
  --corner_threshold 60 \
  --segment_length 4 \
  --splice_threshold 45
```

**Parameter explanations:**
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `--colormode` | `color` | Full color (not black & white) |
| `--hierarchical` | `stacked` | Layer colors for better results |
| `--filter_speckle` | `4` | Remove noise smaller than 4px |
| `--color_precision` | `6` | Bits per RGB channel (higher = more colors) |
| `--gradient_step` | `16` | Color difference between layers |
| `--mode` | `spline` | Smooth curves (vs `pixel` or `polygon`) |
| `--corner_threshold` | `60` | Angle threshold for corners (smoother) |
| `--segment_length` | `4` | Max segment length before subdivision |
| `--splice_threshold` | `45` | Angle for spline splicing |

### Step 3: Remove Background

The first `<path>` element in each SVG is typically the background rectangle. Remove it with:

```bash
# Using perl for multi-line pattern matching
perl -i -0777 -pe 's/<path[^>]*fill="#F[CDEF][^"]*"[^\/]*\/>//s' avatar.svg
```

### Step 4: Crop to Content Bounds

Use ImageMagick to find the actual content bounds, then update the SVG viewBox:

```bash
# Get trim geometry: width height offsetX offsetY
geom=$(magick avatar.svg -trim -format "%w %h %X %Y" info:)
read w h x y <<< "$geom"

# Update SVG attributes
sed -i '' "s/width=\"[0-9]*\"/width=\"$w\"/g" avatar.svg
sed -i '' "s/height=\"[0-9]*\"/height=\"$h\"/g" avatar.svg
sed -i '' "s/viewBox=\"[^\"]*\"/viewBox=\"$x $y $w $h\"/g" avatar.svg
```

### Step 5: Make Square

Expand the viewBox to square dimensions (using the larger side), centered:

```bash
# Get current viewBox
vb=$(grep -o 'viewBox="[^"]*"' avatar.svg | sed 's/viewBox="//;s/"//')
read x y w h <<< "$vb"

# Calculate square size
if [ "$w" -gt "$h" ]; then
  size=$w
  new_y=$((y - (size - h) / 2))
  new_x=$x
else
  size=$h
  new_x=$((x - (size - w) / 2))
  new_y=$y
fi

# Update SVG
sed -i '' "s/viewBox=\"[^\"]*\"/viewBox=\"$new_x $new_y $size $size\"/g" avatar.svg
```

### Step 6: Compress SVG with SVGO

[SVGO](https://github.com/svg/svgo) optimizes SVG files by removing unnecessary data.

**Installation:**
```bash
bun add -g svgo
# or: npm install -g svgo
```

**Compression:**
```bash
svgo avatar.svg -o avatar.svg --multipass
```

This typically achieves **~70% size reduction**.

### Step 7: Generate PNG Versions

Create rasterized versions at 256×256 for web use:

```bash
magick avatar.svg -resize 256x256 avatar.png
```

## Complete Processing Script

```bash
#!/bin/bash
# process-avatars.sh

RAW_DIR="public/raw_avatars"
OUT_DIR="public/avatars"

mkdir -p "$OUT_DIR"

for img in "$RAW_DIR"/*.png; do
  name=$(basename "${img%.png}")
  svg="$OUT_DIR/${name}.svg"
  png="$OUT_DIR/${name}.png"

  echo "Processing $name..."

  # Step 2: Convert to SVG
  vtracer \
    --input "$img" \
    --output "$svg" \
    --colormode color \
    --hierarchical stacked \
    --filter_speckle 4 \
    --color_precision 6 \
    --gradient_step 16 \
    --mode spline \
    --corner_threshold 60 \
    --segment_length 4 \
    --splice_threshold 45

  # Step 3: Remove background (first white path)
  perl -i -0777 -pe 's/<path[^>]*fill="#F[CDEF][^"]*"[^\/]*\/>//s' "$svg"

  # Step 4: Crop to content
  geom=$(magick "$svg" -trim -format "%w %h %X %Y" info:)
  read w h x y <<< "$geom"
  x=${x#+}; y=${y#+}

  # Step 5: Make square
  if [ "$w" -gt "$h" ]; then
    size=$w; new_y=$((y - (size - h) / 2)); new_x=$x
  else
    size=$h; new_x=$((x - (size - w) / 2)); new_y=$y
  fi

  sed -i '' "s/width=\"[0-9]*\"/width=\"$size\"/g" "$svg"
  sed -i '' "s/height=\"[0-9]*\"/height=\"$size\"/g" "$svg"
  sed -i '' "s/viewBox=\"[^\"]*\"/viewBox=\"$new_x $new_y $size $size\"/g" "$svg"

  # Step 6: Compress
  svgo "$svg" -o "$svg" --multipass

  # Step 7: Generate PNG
  magick "$svg" -resize 256x256 "$png"

  echo "  Done: $svg, $png"
done
```

## Final Output

| Character | SVG Size | PNG Size | Dimensions |
|-----------|----------|----------|------------|
| Bart | 97 KB | 136 KB | Square |
| Elayne | 65 KB | 103 KB | Square |
| Ethel | 70 KB | 115 KB | Square |
| Jasper | 99 KB | 156 KB | Square |
| Langley | 175 KB | 155 KB | Square |
| Maurice | 223 KB | 218 KB | Square |
| Primus | 192 KB | 171 KB | Square |
| Robin | 72 KB | 104 KB | Square |

## Dependencies

- **VTracer** - Raster to vector conversion ([GitHub](https://github.com/visioncortex/vtracer))
- **ImageMagick** - Image manipulation (`brew install imagemagick`)
- **SVGO** - SVG optimization (`bun add -g svgo`)

## Notes

- SVG files retain full vector quality at any size
- PNG files are pre-rendered at 256×256 for faster loading
- All assets have transparent backgrounds
- Square aspect ratios ensure consistent display in UI components
