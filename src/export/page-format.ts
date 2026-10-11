export type PageFormat = "A4" | "A3" | "A2" | "A1" | "A0"

// размеры в портретной ориентации, мм; экспорт всегда альбомный (sheetSizeMm в sheet-layout)
export const PAGE_FORMATS_MM: Record<PageFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
}
