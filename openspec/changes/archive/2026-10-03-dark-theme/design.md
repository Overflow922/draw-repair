## Context

Цвета сцены зашиты константами в `src/render.ts` (`INK = "#333"`, сетка `#e0e0e0`, белая заливка помещений, белые подложки подписей и ручек, цвета выделения, ластика, угла, трекинга). Холст прозрачный: фон даёт белая страница. Интерфейс — `src/style.css` с явными цветами в каждом правиле. `drawScene` используется и холстом, и PDF-экспортом (`buildPdf` передаёт `PDF_METRICS` и `grid: false`). Существующие тесты отрисовки проверяют конкретные значения светлых цветов, поэтому светлая палитра обязана повторять их буквально.

## Goals / Non-Goals

**Goals:**
- одна точка правды для цветов сцены — палитра, передаваемая в отрисовку;
- светлая палитра — побайтно прежние строки цветов, PDF без изменений;
- выбор схемы — чистые функции без DOM, тестируемые в node;
- интерфейс переключается одним атрибутом на `<html>`.

**Non-Goals:**
- больше двух схем, пользовательские цвета;
- тёмный PDF;
- изменение формата хранилища чертежей и истории.

## Decisions

### D1. Модуль `src/theme.ts` (домен, без DOM)

```ts
type Theme = "light" | "dark"
interface Palette {
  paper: string        // фон холста, заливка помещений, подложки (контур текста размеров, ручки, обводка точки привязки)
  grid: string
  ink: string          // стены, штриховка, размеры, подписи площади, рамка выделения
  muted: string        // резинка и черновик размера
  square: string       // квадрат установки
  handleStroke: string // контур ручек
  labelBg: string      // полупрозрачная подложка подписи угла
  angle: string        // угол построения и замеры линейки
  track: string
  selection: string    // обводка выделенной стены
  selectedDim: string
  marqueeWall: string
  marqueeDim: string
  erase: string        // подсветка ластика (стены и размеры)
  snap: string         // точка привязки размера
}
LIGHT_PALETTE, DARK_PALETTE, paletteOf(theme)
THEME_KEY = "draw-repair:theme"
parseTheme(value: unknown): Theme | null           // только "light" | "dark"
resolveTheme(choice: Theme | null, systemDark: boolean): Theme
toggledTheme(theme): Theme
themeToggleTitle(theme): "Тёмная тема" | "Светлая тема" // название схемы, на которую переключит кнопка
interface ThemeStorage { getItem(key): string | null; setItem(key, value): void }
loadThemeChoice(storage): Theme | null              // исключение → null
saveThemeChoice(storage, theme): boolean            // исключение → false, без выброса
```

Светлая палитра — текущие значения: `#fff`, `#e0e0e0`, `#333`, `#555`, `#999`, `#0f172a`, `rgba(255, 255, 255, 0.9)`, `#2563eb`, `#db2777`, `rgba(8, 145, 178, 0.5)`, `rgba(8, 145, 178, 0.9)`, `rgba(8, 145, 178, 0.25)`, `rgba(8, 145, 178, 0.4)`, `rgba(220, 38, 38, 0.5)`, `#dc2626`.

Тёмная палитра: фон `#1e1f22`, сетка `#2e3035`, линии `#d4d4d8`, приглушённые `#a1a1aa`, квадрат `#71717a`, контур ручек `#e4e4e7`, подложка угла `rgba(30, 31, 34, 0.9)`, угол `#60a5fa`, трекинг `#f472b6`, выделение на основе `rgb(34, 211, 238)` с теми же долями прозрачности (0.5 / 0.9 / 0.25 / 0.4), ластик `rgba(248, 113, 113, 0.6)`, привязка `#f87171`. Критерии: контраст линий к фону ≥ 7:1, акцентов (угол, трекинг, привязка) ≥ 3:1, сетка заметно слабее линий (контраст к фону от 1.1 до 2).

Альтернатива: читать цвета из CSS-переменных через `getComputedStyle` в отрисовке. Отклонена: отрисовка и PDF стали бы зависеть от DOM, тесты — от браузера.

### D2. Палитра в отрисовке

`RenderOptions.palette?: Palette`, по умолчанию `LIGHT_PALETTE`. Все цвета в `drawScene` и вспомогательных функциях берутся из палитры; константы цветов удаляются из `render.ts`. `drawPatternPreview(canvas, material, palette = LIGHT_PALETTE)`. `buildPdf` палитру не передаёт — PDF всегда светлый без изменения `pdf.ts`.

Холст остаётся прозрачным (`clearRect`), фон даёт CSS (`#canvas-wrap { background: var(--paper) }`). Значение `--paper` в CSS совпадает с `palette.paper` — дублирование двух строк, отмеченное комментарием; заливка помещений тем самым неотличима от фона.

### D3. Интерфейс

`style.css`: цвета вынесены в переменные на `:root` (фон острова, рамка, текст, приглушённый текст, ховер, активный фон/рамка/текст, фон холста, фон попапа). Тёмные значения — под `:root[data-theme="dark"]`, там же `color-scheme: dark` для нативных полей и списков. Светлые значения переменных равны прежним литералам.

`index.html`: кнопка `#theme-toggle` в `#size-box` сразу после `#render-style`, иконка луна/солнце (`currentColor`), обе в разметке, видимость по `data-theme`.

### D4. Проводка в `main.ts`

- `themeChoice = loadThemeChoice(localStorage)`; `systemDark = matchMedia("(prefers-color-scheme: dark)")`.
- `applyTheme()`: `theme = resolveTheme(themeChoice, systemDark.matches)`, `document.documentElement.dataset.theme = theme`, `title` кнопки = `themeToggleTitle(theme)`, перерисовка превью материалов и `redraw()` с `palette: paletteOf(theme)`.
- Вызывается до первой отрисовки, по кнопке (`themeChoice = toggledTheme(theme)`, `saveThemeChoice`) и по `change` у `systemDark` — только при `themeChoice === null`.
- Кнопка не трогает состояние чертежа, выделения, инструмента и истории.

## Risks / Trade-offs

- До выполнения модуля страница рисуется в светлых CSS-цветах — короткая вспышка при тёмной теме. Модуль загружается сразу, вспышка не дольше первого кадра; встроенный скрипт в `<head>` не добавляем ради простоты.
- Дублирование цвета фона в CSS и палитре: при расхождении заливка помещения станет видимым пятном. Ручная проверка MAN-ROOM-DARK и комментарий у обоих значений.
- Существующие тесты завязаны на светлые литералы — светлая палитра обязана их повторять (тест LIGHT-EXACT-1).
