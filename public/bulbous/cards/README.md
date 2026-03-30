# Bulbous — Card Image Naming Convention

All images: PNG, placed in this `/public/bulbous/cards/` folder.
Served at `/bulbous/cards/{filename}.png`

## Naming format

### Numeric cards (28 total — values 3–9, 4 colours)
`{color}_{value}.png`
- Colours: `red`, `blue`, `green`, `yellow`
- Values: `3`, `4`, `5`, `6`, `7`, `8`, `9`
- Example: `red_3.png`, `blue_7.png`, `yellow_9.png`

### Double cards (4 total — 1 per colour)
`{color}_double.png`
- Example: `red_double.png`, `green_double.png`

### Joker cards (2 total)
`joker_circle.png`   ← circle symbol (⭕)
`joker_triangle.png` ← triangle symbol (▲)

## Full list (34 cards)

| Filename           | Type    | Colour  | Value |
|--------------------|---------|---------|-------|
| `red_3.png`        | numeric | red     | 3     |
| `red_4.png`        | numeric | red     | 4     |
| `red_5.png`        | numeric | red     | 5     |
| `red_6.png`        | numeric | red     | 6     |
| `red_7.png`        | numeric | red     | 7     |
| `red_8.png`        | numeric | red     | 8     |
| `red_9.png`        | numeric | red     | 9     |
| `red_double.png`   | double  | red     | ×2    |
| `blue_3.png`       | numeric | blue    | 3     |
| ...                | ...     | ...     | ...   |
| `blue_double.png`  | double  | blue    | ×2    |
| `green_3.png`      | numeric | green   | 3     |
| ...                | ...     | ...     | ...   |
| `green_double.png` | double  | green   | ×2    |
| `yellow_3.png`     | numeric | yellow  | 3     |
| ...                | ...     | ...     | ...   |
| `yellow_double.png`| double  | yellow  | ×2    |
| `joker_circle.png` | joker   | —       | ⭕    |
| `joker_triangle.png`| joker  | —       | ▲     |
