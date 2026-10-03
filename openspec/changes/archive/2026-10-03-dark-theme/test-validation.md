# Test Validation

Изменение: `dark-theme`. Фаза: валидация тестов до реализации. Валидация проведена в свежем
контексте. Утверждениям test-suite.md я не доверял: собрал эталонную реализацию по design D1/D2,
прогнал на ней тесты и мутанты.

Что прочитано:
- proposal.md, design.md (D1–D4), test-plan.md, test-suite.md;
- `specs/color-theme/spec.md`, `specs/room-areas/spec.md` (дельта) и текущая
  `openspec/specs/room-areas/spec.md`;
- тесты: `src/theme.test.ts`, `src/theme-render.test.ts`, `src/theme-pdf.test.ts`, утилиты
  `src/theme.test-utils.ts`;
- продакшн-код: `src/render.ts` (все операции рисования и литералы цветов), `src/export/pdf.ts`,
  `src/main.ts` (места `render`, `drawPatternPreview`, `redraw`).

**Прогон в репозитории** (`npx vitest run`): 29 файлов, 3 FAIL на импорте (`Cannot find module
'./theme'`), 26 файлов / 744 теста PASS. Совпадает с test-suite.md.

**Эталон.** Копия `src/`, `package.json`, `tsconfig.json`, `vite.config.ts` во временном каталоге
вне репозитория, `node_modules` подключён junction. После проверки junction снят первым (`rmdir`),
копия удалена; реальный `node_modules` на месте, `git status` репозитория не изменился, кроме этого
файла.

В копии:
- `src/theme.ts` — строго по D1: тип `Theme`, интерфейс `Palette` из 15 полей, `LIGHT_PALETTE` —
  прежние литералы, `DARK_PALETTE` — значения из D1 (`#1e1f22`, `#2e3035`, `#d4d4d8`, `#a1a1aa`,
  `#71717a`, `#e4e4e7`, `rgba(30, 31, 34, 0.9)`, `#60a5fa`, `#f472b6`, `rgba(34, 211, 238, 0.5/0.9/
  0.25/0.4)`, `rgba(248, 113, 113, 0.6)`, `#f87171`), `paletteOf`, `THEME_KEY`, `parseTheme`
  (строгое сравнение), `resolveTheme` (`choice ?? system`), `toggledTheme`, `themeToggleTitle`,
  `loadThemeChoice`/`saveThemeChoice` с `try/catch`;
- `src/render.ts` — по D2: `RenderOptions.palette?: Palette`, `p = opts.palette ?? LIGHT_PALETTE`,
  все литералы цветов заменены полями палитры и протянуты во вспомогательные функции,
  `drawPatternPreview(canvas, material, palette = LIGHT_PALETTE)`; `pdf.ts` не тронут.

Результат на эталоне:
- `tsc --noEmit` чистый — тесты совместимы с API из D1/D2 (типы `Palette`, `Theme`,
  `RenderOptions.palette`, сигнатура `drawPatternPreview`, `ThemeStorage` структурно принимает
  `memoryStorage`);
- весь набор: 29 файлов, **827 PASS, 1 FAIL** — падает **RND-FIXTURE-1** (см. находку B1);
- все прежние 744 теста проходят со светлой палитрой по умолчанию.

## Findings

### Блокирующие

**B1. RND-FIXTURE-1 невыполним для реализации по спецификации.**
`src/theme-render.test.ts:88–94`. Тест ждёт в «полной» сцене `fullOptions` не меньше 3 залитых дуг
(«ручки»): `ops.filter(fill && hasArc).length >= 3`. Но `fullOptions` задаёт одновременно выделенную
стену (`[walls[0]]`) и выделенный размер (`selectedDims`). По действующему поведению (render.ts:
`singleWalls = selectedWalls.length === 1 && !selectedDims.length`, `singleDim` — симметрично) и по
спецификации («ручки — при выделении **одной** стены») ручки в такой сцене не рисуются вообще.
Единственная залитая дуга — точка привязки `dimSnap`. Эталон даёт 1, тест требует ≥ 3.

Выполнить тест можно только изменив поведение ручек при смешанном выделении, а это вне рамок
изменения и противоречит действующему поведению. Это ошибка фикстуры, а не реализации.

Побочный эффект: тест заявлен как проверка того, что RND-DARK-ONLY-1 и RND-DEFAULT-1 видят ручки, а
они их не видят. Ручки в тёмной схеме покрывает только RND-DARK-ONLY-2 и RND-DARK-HANDLES-1/2,
светлые ручки по умолчанию — никакой тест с явным сравнением (см. N3).

Что исправить (Test Writer): убрать из RND-FIXTURE-1 утверждение о ручках или заменить его верным,
например «есть залитая дуга точки привязки» (`>= 1`). Либо в тесте проверять отдельную сцену с одной
выделенной стеной без размеров (3 ручки), как в RND-DARK-HANDLES-1. Поправить комментарий у
`fullOptions` и описание RND-FIXTURE-1 в test-suite.md («подписи и ручки»).

### Неблокирующие

**N1. RND-DARK-ERASE-1 не различает цвет подсветки стены.**
`ops.some(fill && style === erase)` выполняется за счёт залитых стрелок размера `hoverDim`, он
рисуется тем же цветом. Мутант «подсветка стены ластиком цветом `snap`» (R37) выживает. Литерал
вместо палитры (R24) ловит только RND-DARK-ONLY-1. Рекомендация: рисовать `hover` без `hoverDim`
либо проверять заливку и обводку без дуги до первого `fillText`.

**N2. Замеры линейки в режиме «пространство» (углы помещения) не покрыты.**
В `fullOptions` и RND-DARK-RULER-1 только `ruler.kind === "wall"`. Путь `drawRoomAngle` для
`kind: "space"` в тёмной схеме не исполняется ни одним тестом. Мутант «углы помещения светлой
палитрой» (R48) выживает. В эталоне путь общий с углом построения (`drawAngleArc`), поэтому риск
умеренный. Спецификация явно требует различимости «замеров линейки». Рекомендация: добавить
`kind: "space"` с углом в RND-DARK-ONLY-1 или в отдельный тест.

**N3. RND-DEFAULT-1 не включает ручки.**
Из-за той же фикстуры (B1) сравнение «без палитры = светлая» не охватывает `drawHandles` и ручки
размера. Мутант не построить, пока цвета берутся из `p`. Литерал в ручках ловят тёмные тесты.
Рекомендация: при исправлении B1 добавить сравнение для сцены с одной выделенной стеной.

**N4. Значения тёмной палитры не закреплены.**
Перестановка `selection` ↔ `selectedDim` внутри `DARK_PALETTE` (T23) выживает: тесты отрисовки
ссылаются на поля символически, а критерии контраста выполняются для обоих значений. Это допустимо:
спецификация задаёт свойства (тёмный фон, контраст), а D1 оговаривает «критерии». Оставляю как
осознанный выбор.

**N5. Связь с деталями реализации (допустимая).**
- RND-DARK-SNAP-1, RND-DARK-AUX-1, RND-DARK-ANGLE-1 проверяют точную последовательность или
  количество операций (одна `stroke` на квадрат, `fillRect` + `strokeRect` у подписи угла). Это
  текущая геометрия отрисовки, изменение её не входит в рамки — допустимо.
- DARK-LABEL-1 превращает `rgba(...)` в `rgb(...)` разбором строки. С 8-значным hex это не сработает,
  но D1 задаёт `rgba` — допустимо.
- PDF-LIGHT-1 требует `palette` либо `undefined`, либо тождественно `LIGHT_PALETTE`. Копия
  `{...LIGHT_PALETTE}` не пройдёт, но D2 прямо говорит «`pdf.ts` не меняется» — допустимо.

**N6. Проводка DOM — только ручные проверки MAN-*.**
`main.ts` по D4 тонкий: `applyTheme` вызывает `resolveTheme`, `paletteOf`, `themeToggleTitle`,
`toggledTheme`, `saveThemeChoice`, `loadThemeChoice`. Вся логика решения вынесена в чистые функции
и покрыта модульными тестами с убитыми мутантами. В проекте нет DOM-окружения тестов (jsdom не
подключён), и вводить его ради одной проводки — лишняя зависимость. Поэтому ручная проверка
допустима. Непокрытыми остаются три места проводки:
- `change` у `matchMedia` срабатывает только при `themeChoice === null` (MAN-SYS-3);
- `title` и `data-theme` выставляются на кнопку и `<html>` (MAN-TOGGLE-1);
- кнопка не трогает чертёж, выделение и историю (MAN-TOGGLE-2).

Условие: результаты всех MAN-* (UI-DARK, CANVAS-DARK, ROOM-DARK, PATTERN, SYS-1/2/3, TOGGLE-1/2,
PERSIST-1, PDF-1) записать при verify, проверять на `/draw-repair/` после перезапуска dev-сервера.

**N7. Достоверность утилит.**
`styleRecorder` записывает все операции закраски, которые используют `drawScene` и
`drawPatternPreview`: `fill` (в том числе `fill("evenodd")`), `stroke`, `fillRect`, `strokeRect`,
`fillText`, `strokeText`. Других операций закраски в `render.ts` нет: `clip`, `clearRect`,
`setLineDash` и `measureText` закраску не дают. `save`/`restore` сохраняют и восстанавливают
`fillStyle`/`strokeStyle`/`globalAlpha` стеком, это важно для дуг угла и размеров внутри
`save/restore`. `globalAlpha` не попадает в запись: превью стены с прозрачностью 0.4 проверяется
только по цвету, что требованию достаточно. `hasArc` сбрасывается на `beginPath`, как текущий путь в
canvas. `memoryStorage` бросает исключения на `getItem` и `setItem` раздельно, как заблокированный
`localStorage`. `contrast` — формула WCAG с наложением прозрачности на фон. Утилиты корректны.

Фикстура `northDim` валидна: на эталоне RND-DARK-DIM-1 даёт ровно один текст размера (4000 мм между
гранями западной и восточной стен), RND-DARK-HANDLES-2 — две ручки.

## Requirement Coverage

| Требование / сценарий | Покрытие | Оценка |
|---|---|---|
| Две схемы — светлая не меняет вид | LIGHT-EXACT-1, RND-DEFAULT-1, PATTERN-LIGHT-1, 744 прежних теста | PASS (без ручек — N3) |
| Две схемы — тёмная схема холста | DARK-BG/INK/GRID-1, RND-DARK-GRID/INK/ONLY-1/2, RND-DARK-PREVIEW-1 | PASS |
| Две схемы — тёмная схема интерфейса | MAN-UI-DARK | ручная (N6) |
| Две схемы — превью материалов | PATTERN-DARK-1 по всем материалам, MAN-PATTERN | PASS |
| Вспомогательные построения — различимость | DARK-ACCENT-1/2, DARK-LABEL-1, RND-DARK-SEL/MARQUEE/AUX/SNAP/ANGLE/RULER-1, RND-DARK-ERASE-1 | PASS с N1, N2 |
| Подпись размера в тёмной схеме | RND-DARK-DIM-1, RND-DARK-DRAFT-1, RND-DARK-RULER-1 | PASS |
| Ручки выделенной стены | RND-DARK-HANDLES-1/2, RND-DARK-ONLY-2 | PASS |
| Системная схема по умолчанию | RES-1, RES-2, STORE-2, STORE-7; на лету — MAN-SYS-2 | PASS / ручная |
| Кнопка: переключение, подсказка | TOGGLE-1/2, TITLE-1; DOM — MAN-TOGGLE-1 | PASS / ручная |
| Кнопка: чертёж не меняется | MAN-TOGGLE-2 | ручная (N6) |
| Запоминание: выбор сохраняется, перезапись | STORE-KEY-1, STORE-1, STORE-8, RES-3 | PASS |
| Запоминание: системная после выбора не действует | RES-3 (4 комбинации), MAN-SYS-3 | PASS |
| Запоминание: повреждённое значение | PARSE-2 (13 случаев), STORE-3, STORE-4, STORE-7 | PASS |
| Запоминание: хранилище недоступно | STORE-5, STORE-6, STORE-7 | PASS |
| PDF не зависит от схемы | PDF-LIGHT-1 (через `vi.mock` обёртку `drawScene`), RND-DARK-FILL-2 | PASS |
| room-areas: заливка в тёмной схеме | RND-DARK-FILL-1 (цвет, порядок сетка → заливка → стены) | PASS |
| room-areas: стены и размеры поверх заливки | порядок в RND-DARK-FILL-1, прежние тесты room-areas | PASS |

## Manual Mutation Analysis

Мутанты применялись по одному к эталону в копии. Прогонялись три файла тестов темы, базовый прогон
— 84/84. Для прогона мутантов в копии ослаблено ошибочное утверждение B1 (`>= 1` вместо `>= 3`),
иначе убитым считался бы каждый мутант. Файлы тестов в репозитории не менялись.

| # | Мутант | Результат | Убивает |
|---|---|---|---|
| R01 | заливка помещений `#fff` | KILLED | RND-DARK-ONLY-1/2, RND-DARK-FILL-1 |
| R02 | заливка ручек стены `#fff` | KILLED | RND-DARK-ONLY-2, RND-DARK-HANDLES-1 |
| R03 | контур ручек стены `#0f172a` | KILLED | RND-DARK-ONLY-2, RND-DARK-HANDLES-1 |
| R04 | подложка текста размера `#fff` | KILLED | RND-DARK-ONLY-1/2, RND-DARK-DIM/DRAFT/RULER-1 |
| R05 | заливка ручек размера `#fff` | KILLED | RND-DARK-ONLY-2, RND-DARK-HANDLES-2 |
| R06 | контур ручек размера `#0f172a` | KILLED | RND-DARK-ONLY-2, RND-DARK-HANDLES-2 |
| R07 | обводка точки привязки `#fff` | KILLED | RND-DARK-ONLY-1, RND-DARK-SNAP-1 |
| R08 | точка привязки `#dc2626` | KILLED | RND-DARK-ONLY-1, RND-DARK-SNAP-1 |
| R09 | подложка угла `rgba(255,255,255,0.9)` | KILLED | RND-DARK-ONLY-1, RND-DARK-ANGLE-1 |
| R10 | дуга угла `#2563eb` | KILLED | RND-DARK-ONLY-1, RND-DARK-ANGLE-1 |
| R11 | текст угла `#2563eb` | KILLED | RND-DARK-ONLY-1, RND-DARK-ANGLE-1 |
| R12 | линейка `#2563eb` | KILLED | RND-DARK-ONLY-1, RND-DARK-RULER-1 |
| R13 | трекинг `#db2777` | KILLED | RND-DARK-ONLY-1, RND-DARK-AUX-1 |
| R14 | квадрат установки `#999` | KILLED | RND-DARK-ONLY-1, RND-DARK-AUX-1 |
| R15 | сетка `#e0e0e0` | KILLED | RND-DARK-ONLY-1/2, RND-DARK-GRID-1, RND-DARK-INK-1 |
| R16 | рамка выделения `#333` | KILLED | RND-DARK-ONLY-1, RND-DARK-MARQUEE-1 |
| R17 | резинка размера `#555` | KILLED | RND-DARK-ONLY-1, RND-DARK-AUX-1 |
| R18 | черновик размера `#555` | KILLED | RND-DARK-ONLY-1, RND-DARK-DRAFT-1 |
| R19 | стены и штриховка `#333` | KILLED | RND-DARK-ONLY-1/2, RND-DARK-FILL-1, RND-DARK-INK-1, RND-DARK-PREVIEW-1 |
| R20 | превью материала `#333` | KILLED | PATTERN-DARK-1 |
| R21 | подпись площади `#333` | KILLED | RND-DARK-ONLY-1/2, RND-DARK-INK-1 |
| R22 | выделение стены литералом | KILLED | RND-DARK-ONLY-1/2, RND-DARK-SEL-1 |
| R23 | попадание рамки (стена) литералом | KILLED | RND-DARK-ONLY-1, RND-DARK-MARQUEE-1 |
| R24 | ластик стены литералом | KILLED | только RND-DARK-ONLY-1 |
| R25 | выделенный размер литералом | KILLED | RND-DARK-ONLY-1/2, RND-DARK-HANDLES-2 |
| R26 | попадание рамки (размер) литералом | KILLED | RND-DARK-ONLY-1, RND-DARK-MARQUEE-1 |
| R27 | ластик размера литералом | KILLED | RND-DARK-ONLY-1, RND-DARK-ERASE-1 |
| R28 | размеры `muted` вместо `ink` | KILLED | RND-DARK-DIM-1 |
| R29 | черновик `ink` вместо `muted` | KILLED | RND-DARK-DRAFT-1 |
| R30 | резинка `ink` вместо `muted` | KILLED | RND-DARK-AUX-1 |
| R31 | подложка текста `labelBg` вместо `paper` | KILLED | RND-DARK-DIM/DRAFT/RULER-1 |
| R32 | заливка ручек `labelBg` вместо `paper` | KILLED | RND-DARK-HANDLES-1 |
| R33 | контур ручек `ink` вместо `handleStroke` | KILLED | RND-DARK-HANDLES-1 |
| R34 | обводка привязки `grid` вместо `paper` | KILLED | RND-DARK-SNAP-1 |
| R35 | выделение `selectedDim` вместо `selection` | KILLED | RND-DARK-SEL-1 |
| R36 | попадание рамки `selection` вместо `marqueeWall` | KILLED | RND-DARK-MARQUEE-1 |
| R37 | **ластик стены `snap` вместо `erase`** | **SURVIVED** | — (N1) |
| R38 | квадрат `muted` вместо `square` | KILLED | RND-DARK-AUX-1 |
| R39 | трекинг `angle` вместо `track` | KILLED | RND-DARK-AUX-1 |
| R40 | линейка `ink` вместо `angle` | KILLED | RND-DARK-RULER-1 |
| R41 | подложка угла `paper` вместо `labelBg` | KILLED | RND-DARK-ANGLE-1 |
| R42 | подпись площади `muted` | KILLED | RND-DARK-INK-1 |
| R43 | рамка выделения `muted` | KILLED | RND-DARK-MARQUEE-1 |
| R44 | заливка помещений и без сетки | KILLED | RND-DARK-FILL-2 |
| R45 | палитра по умолчанию тёмная | KILLED | RND-DEFAULT-1 |
| R46 | `drawPatternPreview` игнорирует палитру | KILLED | PATTERN-DARK-1 |
| R47 | только превью стены литералом | KILLED | RND-DARK-ONLY-1, RND-DARK-PREVIEW-1 |
| R48 | **углы помещения линейки светлой палитрой** | **SURVIVED** | — (N2) |
| R49 | размер в рамке `selectedDim` | KILLED | RND-DARK-MARQUEE-1 |
| R50 | ластик размера `selection` | KILLED | RND-DARK-ERASE-1 |
| R51 | заливка помещений до сетки (убрана после) | KILLED | RND-DARK-FILL-1 |
| P01 | `buildPdf` передаёт `DARK_PALETTE` | KILLED | PDF-LIGHT-1 |
| P02 | `buildPdf` с `grid: true` | KILLED | PDF-LIGHT-1 |
| P03 | `buildPdf` без `grid` | KILLED | PDF-LIGHT-1 |
| T01 | `parseTheme` без учёта регистра | KILLED | PARSE-2, STORE-3 |
| T02 | `parseTheme` с `trim` | KILLED | PARSE-2 |
| T03 | `parseTheme` принимает любую строку | KILLED | PARSE-2, STORE-3, STORE-7 |
| T04 | `resolveTheme` игнорирует выбор | KILLED | RES-3 |
| T05 | `resolveTheme` инвертирует систему | KILLED | RES-1, RES-2, STORE-7 |
| T06 | системная тёмная побеждает выбор | KILLED | RES-3 |
| T07 | `loadThemeChoice` без `try/catch` | KILLED | STORE-5, STORE-7 |
| T08 | `saveThemeChoice` без `try/catch` | KILLED | STORE-6 |
| T09 | `saveThemeChoice` при ошибке → `true` | KILLED | STORE-6 |
| T10 | чтение по другому ключу | KILLED | STORE-1, STORE-4, STORE-8 |
| T11 | запись по другому ключу | KILLED | STORE-1, STORE-8 |
| T12 | `THEME_KEY` = `draw-repair-theme` | KILLED | STORE-KEY-1, STORE-1 |
| T13 | подсказка по текущей схеме | KILLED | TITLE-1 |
| T14 | `toggledTheme` — тождество | KILLED | TOGGLE-1 |
| T15 | `paletteOf` всегда светлая | KILLED | PAL-OF-1 |
| T16 | чтение без `parseTheme` | KILLED | STORE-3, STORE-7 |
| T17 | запись `JSON.stringify` | KILLED | STORE-1, STORE-8 |
| T18 | тёмная сетка слишком яркая (`#52525b`) | KILLED | DARK-GRID-1 |
| T19 | белая подложка угла в тёмной | KILLED | DARK-LABEL-1, DARK-DIFF-1 |
| T20 | тёмные линии низкого контраста | KILLED | DARK-BG-1, DARK-INK-1 |
| T21 | белый фон в тёмной палитре | KILLED | DARK-*, RND-DARK-FILL-1 |
| T22 | светлая палитра изменена (`#9a9a9a`) | KILLED | LIGHT-EXACT-1 |
| T23 | **в тёмной палитре переставлены `selection`/`selectedDim`** | **SURVIVED** | — (N4, допустимо) |
| T24 | точка привязки неразличима (`#3f1d1d`) | KILLED | DARK-ACCENT-1 |

Итог: 78 мутантов, 75 убито, 3 выжили (R37, R48 — пробелы N1, N2; T23 — осознанно, N4).

## Quality of Assertions

- Тесты проверяют наблюдаемое: цвет каждой операции закраски, порядок слоёв и результат функций
  выбора. Внутренние функции `render.ts` и приватные константы тестами не трогаются.
- Инвариант RND-DARK-ONLY-1/2 («ни одного цвета вне тёмной палитры») — сильная сетка: он убил все
  мутанты с оставленным литералом.
- Перепутанные поля палитры ловятся точечными тестами по каждому элементу, кроме N1.
- Пороговые проверки контраста соответствуют критериям D1.

## VERDICT

Тесты сильные: 75 из 78 мутантов убиты, утилиты достоверны, API совпадает с D1/D2. Но один тест
невыполним для реализации по спецификации: эталон по дизайну стабильно падает на RND-FIXTURE-1.
Одобрить такой набор нельзя — по Rule 5 реализатор не сможет его пройти, не нарушив действующее
поведение ручек.

Что должно измениться (Test Writer):
1. **B1** — исправить RND-FIXTURE-1 (`src/theme-render.test.ts:88–94`): в `fullOptions` выделены и
   стена, и размер, поэтому ручек нет. Убрать требование `>= 3` залитых дуг или проверять ручки в
   отдельной сцене с одной выделенной стеной без размеров. Поправить комментарий и строку
   RND-FIXTURE-1 в test-suite.md.

Желательно в том же раунде (не блокирует):
2. N1 — сделать RND-DARK-ERASE-1 различающим цвет подсветки стены (без `hoverDim` в той же сцене).
3. N2 — покрыть `ruler.kind === "space"` с углами помещения в тёмной схеме.
4. N3 — сравнение «без палитры = светлая» для сцены с ручками.

VERDICT: FAIL


---

# Раунд 2

Повторная валидация после доработки `src/theme-render.test.ts` по раунду 1 (test-suite.md, версия
2). Эталон собран заново во временной копии вне репозитория: тот же `src/theme.ts` по D1 и тот же
патч `render.ts` по D2, `node_modules` подключён junction. После проверки junction снят первым,
копия удалена, реальный `node_modules` на месте. В репозитории изменён только этот файл.

Изменились только `src/theme-render.test.ts` и test-suite.md. `src/theme.test.ts`,
`src/theme-pdf.test.ts` и `src/theme.test-utils.ts` не менялись: время изменения раньше раунда 1.

**Прогон в репозитории:** 26 файлов, 744 PASS, 3 файла темы падают на импорте `./theme` — ожидаемо.

**Прогон на эталоне:** `tsc --noEmit` чистый, весь набор — **29 файлов, 830/830 PASS**. Тесты не
требуют ничего сверх спецификации и дизайна. Фикстура `RulerReading` с `kind: "space"` в
RND-DARK-RULER-2 соответствует типам `ruler.ts`.

## Закрытие находок раунда 1

| Находка | Исправление | Проверка |
|---|---|---|
| B1 (блокирующая) | RND-FIXTURE-1 требует ≥ 1 залитой дуги (точка привязки). Комментарий объясняет, почему ручек нет | проходит на эталоне — **закрыта** |
| N1 | RND-DARK-ERASE-1: подсветка стены без размеров в сцене — ровно одна заливка и одна обводка цветом `erase`; размер — отдельная сцена | R37 (`snap` вместо `erase`) и R24 теперь убиты RND-DARK-ERASE-1 — **закрыта** |
| N2 | RND-DARK-RULER-2: `kind: "space"` с пролётом 4000 и углом помещения 90° — цвет текста, подложка, рамка подписи, все обводки цветом `angle` | R48 (углы помещения светлой палитрой) убит — **закрыта** |
| N3 | RND-DEFAULT-2: ручки стены и выделенного размера — без палитры и со светлой совпадают, у стены 3 ручки | новые мутанты R52/R53 (ручки при палитре по умолчанию тёмные) убиты — **закрыта** |
| N4 | осознанно не менялось | T23 выживает, допустимо (критерии контраста вместо точных значений, D1) |
| N5, N6, N7 | без изменений | остаются в силе; условие N6 — результаты MAN-* записать при verify |

## Мутационный анализ (повтор)

Повторно запущены все 78 мутантов раунда 1 — без ослабления тестов, на неизменённых файлах. К ним
добавлены 3 новых:

| # | Мутант | Результат | Убивает |
|---|---|---|---|
| R24 | ластик стены литералом | KILLED | RND-DARK-ONLY-1, RND-DARK-ERASE-1 |
| R37 | ластик стены `snap` вместо `erase` | KILLED | RND-DARK-ERASE-1 |
| R45 | палитра по умолчанию тёмная | KILLED | RND-DEFAULT-1, RND-DEFAULT-2 |
| R48 | углы помещения линейки светлой палитрой | KILLED | RND-DARK-RULER-2 |
| R52 | ручки стены при палитре по умолчанию — тёмные | KILLED | RND-DEFAULT-2 |
| R53 | ручки выделенного размера при палитре по умолчанию — тёмные | KILLED | RND-DEFAULT-1, RND-DEFAULT-2 |
| R54 | пролёт линейки цветом `ink` | KILLED | RND-DARK-RULER-1, RND-DARK-RULER-2 |
| T23 | в тёмной палитре переставлены `selection`/`selectedDim` | SURVIVED | — (N4, допустимо) |

Остальные мутанты раунда 1 убиты теми же тестами, что и раньше. Итог: **81 мутант, 80 убито,
1 выжил (T23, осознанно)**.

## Оценка новых и изменённых тестов

- RND-DEFAULT-2 сравнивает полные записи операций и проверяет число ручек, поэтому тест не пройдёт
  без ручек.
- RND-DARK-ERASE-1 проверяет точные количества (1 заливка, 1 обводка), что соответствует
  `drawOutline`: заливка формы и одна обводка контура. Привязка к геометрии допустима, как в N5.
- RND-DARK-RULER-2 проверяет строку `"4000"` и подпись `"90°"`, а не только цвета, поэтому пустой
  отрисовкой его не пройти.
- Ослабленных или удалённых проверок нет: изменения только ужесточают набор, кроме RND-FIXTURE-1.
  Там ослабление исправляет утверждение, противоречившее спецификации.

## VERDICT (раунд 2)

Блокирующих находок нет. Все тесты выполнимы для реализации по D1/D2 (эталон 830/830, `tsc`
чистый). Значимые мутанты убиты, пробелы N1–N3 закрыты. Проводка в DOM остаётся за ручными MAN-*
с обязательной записью результатов при verify (N6).

VERDICT: PASS
