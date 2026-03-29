# Capivaras — Card Image Naming Convention

All images: PNG, placed in this `/public/cards/` folder.
Served at `/capivaras/cards/{filename}.png`

## Naming format

`cap{N}_{lilies}_{_bird}` where:
- `N` = number of capivaras on the card (1–5)
- `{lilies}` = lily colours present, sorted alphabetically (B=Blue, R=Red, W=White, Y=Yellow). Omit if none.
- `_bird` suffix if the card has the bird symbol. Omit if not.

## Full list (36 cards)

| Filename          | Capivaras | Lilies  | Bird |
|-------------------|-----------|---------|------|
| `cap1`            | 1         | —       | —    |
| `cap1_R`          | 1         | R       | —    |
| `cap1_BW`         | 1         | B + W   | —    |
| `cap1_W_bird`     | 1         | W       | ✓    |
| `cap2`            | 2         | —       | —    |
| `cap2_Y`          | 2         | Y       | —    |
| `cap2_B`          | 2         | B       | —    |
| `cap2_bird`       | 2         | —       | ✓    |
| `cap2_Y_bird`     | 2         | Y       | ✓    |
| `cap2_R_bird`     | 2         | R       | ✓    |
| `cap3`            | 3         | —       | —    |
| `cap3_Y`          | 3         | Y       | —    |
| `cap3_B`          | 3         | B       | —    |
| `cap3_bird`       | 3         | —       | ✓    |
| `cap4`            | 4         | —       | —    |
| `cap4_bird`       | 4         | —       | ✓    |
| `cap5`            | 5         | —       | —    |
| `cap5` *(bird)*   | 5         | —       | ✓    | ← use same image as cap5

## Video files

Rules video: `/capivaras-regras.mp4`  
Place as `public/capivaras/regras.mp4`

