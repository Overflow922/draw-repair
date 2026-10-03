Одобренные тесты (`test-validation.md`: VERDICT: PASS, раунд 2):

- `src/theme.test.ts`
- `src/theme-render.test.ts`
- `src/theme-pdf.test.ts`
- утилита `src/theme.test-utils.ts`

Задачи меняют только production-код. Тесты и утилиты не меняются. Если тест окажется противоречащим спецификации, реализация останавливается и оформляется test-change-request (CLAUDE.md, правило 5). Новых зависимостей нет.

## 1. Модуль схемы (theme.ts)

- [x] 1.1 Типы `Theme`, `Palette`; `LIGHT_PALETTE` (прежние литералы), `DARK_PALETTE`, `paletteOf` (design D1; тесты LIGHT-EXACT-1, PAL-OF-1, DARK-*)
- [x] 1.2 `THEME_KEY`, `parseTheme`, `resolveTheme`, `toggledTheme`, `themeToggleTitle`, `loadThemeChoice`, `saveThemeChoice` с перехватом ошибок хранилища (design D1; тесты PARSE-*, RES-*, TOGGLE-*, TITLE-1, STORE-*)

## 2. Отрисовка (render.ts)

- [x] 2.1 `RenderOptions.palette` (по умолчанию светлая); все цвета `drawScene` и вспомогательных функций — из палитры; константы цветов удалить (design D2; тесты RND-*)
- [x] 2.2 `drawPatternPreview(canvas, material, palette = LIGHT_PALETTE)` (тесты PATTERN-*)
- [x] 2.3 `pdf.ts` не меняется (тест PDF-LIGHT-1)

## 3. Интерфейс (index.html, style.css, main.ts)

- [x] 3.1 CSS-переменные на `:root` со светлыми значениями, равными прежним литералам; тёмные значения и `color-scheme: dark` под `:root[data-theme="dark"]`; `#canvas-wrap` с фоном `--paper` (design D3; MAN-UI-DARK, MAN-CANVAS-DARK, MAN-ROOM-DARK)
- [x] 3.2 Кнопка `#theme-toggle` после `#render-style` с иконками луна/солнце (design D3; MAN-TOGGLE-1)
- [x] 3.3 Проводка: выбор из `localStorage`, `matchMedia`, `applyTheme` до первой отрисовки, по кнопке и по смене системной настройки без выбора; перерисовка превью материалов и холста с палитрой (design D4; MAN-SYS-*, MAN-TOGGLE-*, MAN-PERSIST-1, MAN-PATTERN)

## 4. Проверка

- [x] 4.1 `npx vitest run` — все тесты зелёные, одобренные не изменены
- [x] 4.2 `npm run build` (`tsc && vite build`); форматтер и линтер в проекте не настроены; мутационного инструмента нет — ручной анализ в `test-validation.md`
- [x] 4.3 Ручная проверка MAN-* в браузере (`/draw-repair/`, перезапуск dev-сервера), результаты — ниже
- [x] 4.4 `openspec validate dark-theme`, просмотр `git diff`

## Результаты проверки

- 4.1: `npx vitest run` — 29 файлов, 830 тестов зелёные. Утверждённые тесты и утилиты после валидации (раунд 2) не менялись.
- 4.2: `npm run build` (`tsc && vite build`) — успешно; предупреждение о размере чанка было и до изменения. Форматтер и линтер в проекте не настроены. Мутационного инструмента нет — ручной анализ в `test-validation.md` (81 мутант, выжил 1 допустимый, N4).
- 4.3: Firefox, `/draw-repair/` после перезапуска dev-сервера. Профиль был пустым; для проверки создан временный чертёж (комната 420×320 из четырёх материалов и размер), после проверки `localStorage` очищен до исходного пустого состояния:
  - MAN-SYS-1 — без выбора при светлой ОС открывается светлая схема, подсказка «Тёмная тема», вид прежний;
  - MAN-UI-DARK, MAN-CANVAS-DARK — острова, поля и списки тёмные, активные кнопки выделены, фон холста `rgb(30, 31, 34)`, сетка приглушена;
  - MAN-ROOM-DARK — заливка помещения неотличима от фона, сетки внутри нет;
  - MAN-PATTERN — превью материалов в панели «Стена» нарисованы светлыми линиями;
  - MAN-TOGGLE-1/2 — кнопка переключает схему и подсказку; чертёж в хранилище и состояние кнопки отмены не меняются;
  - MAN-PERSIST-1 — после перезагрузки сохранена тёмная схема (`draw-repair:theme = dark`), обратное переключение записывает `light`;
  - MAN-SYS-2/3 — смену темы ОС на лету в этом окружении эмулировать нельзя; логика покрыта `resolveTheme` (тесты RES-*), слушатель `change` срабатывает только при `themeChoice === null` — проверено чтением кода;
  - MAN-PDF-1 — файл не скачивался; `pdf.ts` не менялся и не передаёт палитру, это закреплено тестом PDF-LIGHT-1.
- 4.4: `openspec validate dark-theme` — валидно (предупреждения RFC 2119 о SHALL/MUST — как у остальных русскоязычных спецификаций проекта). `git diff` просмотрен: тесты после валидации не менялись, отладочного кода нет, зависимости не добавлены.
