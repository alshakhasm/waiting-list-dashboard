# Data Model: UI Aesthetics

## Entities
- Theme
  - name, palette (semantic tokens), contrast_mode, typography_scale, spacing_scale
- TypographyPreset
  - name, base_font_size, line_height, scale_ratio
- Preference
  - user_id, theme, font_size_preset, updated_at
- LegendItem (referenced)
  - status/category, color, indicator, label

## Constraints
- Preferences persist between sessions
- High-contrast palette meets accessibility contrast
- Non-color indicators are present for critical statuses
