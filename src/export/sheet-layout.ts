import { PAGE_FORMATS_MM } from "./page-format"
import type { PageFormat } from "./page-format"

// Рамка листа, основная надпись и область чертежа. Все размеры — абсолютные миллиметры на бумаге
// (спецификация pdf-export; форма «Основная надпись на чертежах строительных изделий (первый лист)», ГОСТ Р 21.1101).

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

export const FRAME_LINE_MM = 0.8
export const GRID_LINE_MM = 0.25

const FRAME_LEFT_MM = 20
const FRAME_OTHER_MM = 5
const TITLE_BLOCK_W_MM = 185
const TITLE_BLOCK_H_MM = 55

export function sheetSizeMm(format: PageFormat): { w: number; h: number } {
  const [pw, ph] = PAGE_FORMATS_MM[format]
  return { w: ph, h: pw }
}

export function frameRect(format: PageFormat): Rect {
  const { w, h } = sheetSizeMm(format)
  return { x: FRAME_LEFT_MM, y: FRAME_OTHER_MM, w: w - FRAME_LEFT_MM - FRAME_OTHER_MM, h: h - 2 * FRAME_OTHER_MM }
}

export function titleBlockRect(format: PageFormat): Rect {
  const frame = frameRect(format)
  return {
    x: frame.x + frame.w - TITLE_BLOCK_W_MM,
    y: frame.y + frame.h - TITLE_BLOCK_H_MM,
    w: TITLE_BLOCK_W_MM,
    h: TITLE_BLOCK_H_MM,
  }
}

// внутренность рамки над основной надписью, на всю ширину рамки
export function drawingArea(format: PageFormat): Rect {
  const frame = frameRect(format)
  return { x: frame.x, y: frame.y, w: frame.w, h: titleBlockRect(format).y - frame.y }
}

// Графа основной надписи в координатах надписи (начало — её левый верхний угол). label — печатная подпись графы.
export interface TitleCell {
  id: string
  x: number
  y: number
  w: number
  h: number
  label?: string
}

const cell = (id: string, x: number, y: number, w: number, h: number, label?: string): TitleCell =>
  label === undefined ? { id, x, y, w, h } : { id, x, y, w, h, label }

const TITLE_CELLS: readonly TitleCell[] = [
  // правая часть
  cell("1", 65, 0, 120, 15),
  cell("5", 65, 15, 70, 25),
  cell("label:Стадия", 135, 15, 15, 5, "Стадия"),
  cell("label:Масса", 150, 15, 15, 5, "Масса"),
  cell("label:Масштаб", 165, 15, 20, 5, "Масштаб"),
  cell("6", 135, 20, 15, 15),
  cell("24", 150, 20, 15, 15),
  cell("25", 165, 20, 20, 15),
  cell("7", 135, 35, 20, 5, "Лист"),
  cell("8", 155, 35, 30, 5, "Листов"),
  cell("23", 65, 40, 70, 15),
  cell("9", 135, 40, 50, 15),
  // подписная часть: заголовки таблицы изменений и графы 10–13
  cell("label:Изм.", 0, 15, 10, 5, "Изм."),
  cell("label:Кол.", 10, 15, 10, 5, "Кол."),
  cell("label:Лист", 20, 15, 10, 5, "Лист"),
  cell("label:№док.", 30, 15, 10, 5, "№док."),
  cell("label:Подп.", 40, 15, 15, 5, "Подп."),
  cell("label:Дата", 55, 15, 10, 5, "Дата"),
  cell("10", 0, 20, 20, 35),
  cell("11", 20, 20, 20, 35),
  cell("12", 40, 20, 15, 35),
  cell("13", 55, 20, 10, 35),
]

export function titleBlockCells(): readonly TitleCell[] {
  return TITLE_CELLS
}

const line = (x1: number, y1: number, x2: number, y2: number): Line => ({ x1, y1, x2, y2 })

// Внутренние линии основной надписи (тонкие, 0,25 мм) в координатах надписи; контур надписи рисуется отдельно.
const TITLE_GRID: readonly Line[] = [
  // горизонтали подписной части и общие горизонтали
  line(0, 5, 65, 5),
  line(0, 10, 65, 10),
  line(0, 15, 185, 15),
  line(0, 20, 65, 20),
  line(135, 20, 185, 20),
  line(0, 25, 65, 25),
  line(0, 30, 65, 30),
  line(0, 35, 65, 35),
  line(135, 35, 185, 35),
  line(0, 40, 185, 40),
  line(0, 45, 65, 45),
  line(0, 50, 65, 50),
  // вертикали: столбцы таблицы изменений, граница частей, блок стадии
  line(10, 0, 10, 20),
  line(20, 0, 20, 55),
  line(30, 0, 30, 20),
  line(40, 0, 40, 55),
  line(55, 0, 55, 55),
  line(65, 0, 65, 55),
  line(135, 15, 135, 55),
  line(150, 15, 150, 35),
  line(155, 35, 155, 40),
  line(165, 15, 165, 35),
]

export function titleBlockGrid(): readonly Line[] {
  return TITLE_GRID
}

export interface TitleBlockContent {
  name: string
  scale: number
  date: Date
  pageName?: string // название плана страницы (графа 5); без него графа 5 пуста
}

export interface TitleBlockText {
  cellId: string
  text: string
}

const pad2 = (n: number): string => String(n).padStart(2, "0")

// Только заполненные графы: 1 — имя чертежа, 5 — название плана страницы (если задано), 6 — стадия «Р», 25 — масштаб,
// 13 — месяц и год «ММ.ГГ».
export function titleBlockTexts(content: TitleBlockContent): TitleBlockText[] {
  const { name, scale, date, pageName } = content
  const texts: TitleBlockText[] = []
  if (name !== "") texts.push({ cellId: "1", text: name })
  if (pageName !== undefined && pageName !== "") texts.push({ cellId: "5", text: pageName })
  texts.push({ cellId: "6", text: "Р" })
  texts.push({ cellId: "25", text: `1:${scale}` })
  texts.push({ cellId: "13", text: `${pad2(date.getMonth() + 1)}.${pad2(date.getFullYear() % 100)}` })
  return texts
}
