# Test Suite

Прогон до реализации: `npx vitest run src/theme.test.ts src/theme-render.test.ts src/theme-pdf.test.ts` — все три файла не загружаются: `Cannot find module './theme'`. Все тесты в состоянии **FAIL (import)**. Фикстура размера `northDim` проверена отдельно: точки размера разрешаются в (10, 10) и (410, 10).

Версия 2 — после раунда 1 валидации:
- B1 — RND-FIXTURE-1 больше не требует ручек при смешанном выделении (по спецификации их там нет); ручки при палитре по умолчанию проверяет новый RND-DEFAULT-2 (N3);
- N1 — RND-DARK-ERASE-1 проверяет подсветку стены и размера в раздельных сценах;
- N2 — новый RND-DARK-RULER-2: пролёт и угол помещения у линейки.

Новые файлы:
- `src/theme.test.ts` — выбор схемы, хранилище, палитры;
- `src/theme-render.test.ts` — цвета сцены и превью материалов;
- `src/theme-pdf.test.ts` — палитра и сетка в PDF (обёртка `drawScene` через `vi.mock`);
- `src/theme.test-utils.ts` — записывающий стили контекст `styleRecorder`, фейковый холст `previewCanvas`, контраст WCAG, хранилище в памяти с отказами.

Существующие тесты не меняются.

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PARSE-1 | Запоминание выбора | src/theme.test.ts | PARSE-1: «light» и «dark» распознаются | FAIL (import) |
| PARSE-2 | Запоминание выбора (повреждённое) | src/theme.test.ts | PARSE-2: %j — не схема (13 случаев) | FAIL (import) |
| RES-1 | Схема по умолчанию — системная | src/theme.test.ts | RES-1: выбора нет, ОС тёмная — тёмная | FAIL (import) |
| RES-2 | Схема по умолчанию — системная | src/theme.test.ts | RES-2: выбора нет, ОС не тёмная — светлая | FAIL (import) |
| RES-3 | Запоминание выбора | src/theme.test.ts | RES-3: выбор побеждает (4 случая) | FAIL (import) |
| TOGGLE-1 | Кнопка переключения | src/theme.test.ts | TOGGLE-1: переключает на противоположную | FAIL (import) |
| TOGGLE-2 | Кнопка переключения | src/theme.test.ts | TOGGLE-2: двойное переключение | FAIL (import) |
| TITLE-1 | Кнопка переключения | src/theme.test.ts | TITLE-1: подсказка называет целевую схему | FAIL (import) |
| STORE-KEY-1 | Запоминание выбора | src/theme.test.ts | STORE-KEY-1: ключ хранилища | FAIL (import) |
| STORE-1 | Запоминание выбора | src/theme.test.ts | STORE-1: выбор читается после «перезагрузки» | FAIL (import) |
| STORE-2 | Схема по умолчанию | src/theme.test.ts | STORE-2: пустое хранилище | FAIL (import) |
| STORE-3 | Повреждённое значение | src/theme.test.ts | STORE-3: повреждённое значение (5 случаев) | FAIL (import) |
| STORE-4 | Повреждённое значение | src/theme.test.ts | STORE-4: чужой ключ | FAIL (import) |
| STORE-5 | Хранилище недоступно | src/theme.test.ts | STORE-5: чтение бросает | FAIL (import) |
| STORE-6 | Хранилище недоступно | src/theme.test.ts | STORE-6: запись бросает | FAIL (import) |
| STORE-7 | Хранилище недоступно | src/theme.test.ts | STORE-7: системная схема после сбоев | FAIL (import) |
| STORE-8 | Запоминание выбора | src/theme.test.ts | STORE-8: перезапись выбора | FAIL (import) |
| LIGHT-EXACT-1 | Светлая схема не меняет вид | src/theme.test.ts | LIGHT-EXACT-1: прежние цвета | FAIL (import) |
| PAL-OF-1 | Две схемы | src/theme.test.ts | PAL-OF-1: paletteOf | FAIL (import) |
| DARK-KEYS-1 | Две схемы | src/theme.test.ts | DARK-KEYS-1: все цвета заданы | FAIL (import) |
| DARK-BG-1 | Тёмная схема холста | src/theme.test.ts | DARK-BG-1: фон тёмный, линии светлые | FAIL (import) |
| DARK-INK-1 | Тёмная схема холста | src/theme.test.ts | DARK-INK-1: контраст ≥ 7 | FAIL (import) |
| DARK-GRID-1 | Тёмная схема холста | src/theme.test.ts | DARK-GRID-1: сетка 1.1…2 | FAIL (import) |
| DARK-ACCENT-1 | Вспомогательные построения | src/theme.test.ts | DARK-ACCENT-1 (5 цветов, ≥ 3) | FAIL (import) |
| DARK-ACCENT-2 | Вспомогательные построения | src/theme.test.ts | DARK-ACCENT-2 (6 цветов, ≥ 1.5) | FAIL (import) |
| DARK-LABEL-1 | Вспомогательные построения | src/theme.test.ts | DARK-LABEL-1: подложка угла тёмная | FAIL (import) |
| DARK-DIFF-1 | Две схемы | src/theme.test.ts | DARK-DIFF-1: отличия от светлой | FAIL (import) |
| RND-DEFAULT-1 | Светлая схема не меняет вид | src/theme-render.test.ts | RND-DEFAULT-1: без палитры = светлая | FAIL (import) |
| RND-DEFAULT-2 | Светлая схема не меняет вид | src/theme-render.test.ts | RND-DEFAULT-2: ручки без палитры = светлая | FAIL (import) |
| RND-FIXTURE-1 | (проверка фикстуры) | src/theme-render.test.ts | RND-FIXTURE-1: сцена рисует размеры, подписи, точку привязки | FAIL (import) |
| RND-DARK-ONLY-1 | Тёмная схема холста | src/theme-render.test.ts | RND-DARK-ONLY-1: только тёмная палитра | FAIL (import) |
| RND-DARK-ONLY-2 | Тёмная схема холста | src/theme-render.test.ts | RND-DARK-ONLY-2: с ручками | FAIL (import) |
| RND-DARK-GRID-1 | Тёмная схема холста | src/theme-render.test.ts | RND-DARK-GRID-1 | FAIL (import) |
| RND-DARK-FILL-1 | room-areas: Заливка в тёмной схеме | src/theme-render.test.ts | RND-DARK-FILL-1 | FAIL (import) |
| RND-DARK-FILL-2 | PDF не зависит от схемы | src/theme-render.test.ts | RND-DARK-FILL-2 | FAIL (import) |
| RND-DARK-INK-1 | Тёмная схема холста | src/theme-render.test.ts | RND-DARK-INK-1 | FAIL (import) |
| RND-DARK-DIM-1 | Подпись размера в тёмной схеме | src/theme-render.test.ts | RND-DARK-DIM-1 | FAIL (import) |
| RND-DARK-HANDLES-1 | Ручки выделенной стены | src/theme-render.test.ts | RND-DARK-HANDLES-1 | FAIL (import) |
| RND-DARK-HANDLES-2 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-HANDLES-2 | FAIL (import) |
| RND-DARK-SEL-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-SEL-1 | FAIL (import) |
| RND-DARK-ERASE-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-ERASE-1 | FAIL (import) |
| RND-DARK-MARQUEE-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-MARQUEE-1 | FAIL (import) |
| RND-DARK-AUX-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-AUX-1 | FAIL (import) |
| RND-DARK-DRAFT-1 | Подпись размера в тёмной схеме | src/theme-render.test.ts | RND-DARK-DRAFT-1 | FAIL (import) |
| RND-DARK-SNAP-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-SNAP-1 | FAIL (import) |
| RND-DARK-ANGLE-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-ANGLE-1 | FAIL (import) |
| RND-DARK-RULER-1 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-RULER-1 | FAIL (import) |
| RND-DARK-RULER-2 | Вспомогательные построения | src/theme-render.test.ts | RND-DARK-RULER-2: пролёт и угол помещения | FAIL (import) |
| RND-DARK-PREVIEW-1 | Тёмная схема холста | src/theme-render.test.ts | RND-DARK-PREVIEW-1 | FAIL (import) |
| PATTERN-DARK-1 | Превью материалов | src/theme-render.test.ts | PATTERN-DARK-1 (по материалу) | FAIL (import) |
| PATTERN-LIGHT-1 | Светлая схема не меняет вид | src/theme-render.test.ts | PATTERN-LIGHT-1 (по материалу) | FAIL (import) |
| PDF-LIGHT-1 | PDF не зависит от схемы | src/theme-pdf.test.ts | PDF-LIGHT-1 | FAIL (import) |

## Coverage

### Happy paths

- распознавание схем, системная схема, переключение, сохранение и чтение выбора;
- тёмная сцена: сетка, заливка, стены, размеры, подписи, ручки, построения; превью материалов.

### Boundary cases

- регистр, пробелы, нестроковые значения; сетка без заливки; контрастные пороги.

### Negative cases

- исключения хранилища при чтении и записи; чужой ключ; повреждённые значения.

### Invariants

- без палитры — как светлая; в тёмной схеме только цвета тёмной палитры; двойное переключение; приоритет выбора.

### Integration cases

- PDF через `buildPdf` (PDF-LIGHT-1); DOM-проводка — ручные MAN-* из test-plan.md.

## Unexpected Passes

- нет (все файлы падают на импорте).

## Tests That Could Not Run

- DOM, CSS и `matchMedia` — в проекте нет DOM-окружения тестов, покрываются ручными MAN-*.
