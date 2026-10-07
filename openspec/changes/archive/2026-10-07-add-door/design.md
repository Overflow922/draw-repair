## Context

Элементы стены уже устроены как размеченное объединение `WallElement = Doorway | WallWindow` (`src/types.ts`, change add-window D1). Геометрия, инвариант, правка и сцена (`src/doorway/*`) работают с элементом любого вида. По виду различаются только:
- `element-kind.ts` — параметры по умолчанию и допустимость полей;
- `doorway-edit.ts` — `placeDoorway` / `placeWindow`, `setSill`;
- `doorway-tool.ts` — `createElementTool(kind, host, panel)`, один экземпляр на вид;
- `render.ts` / `export/pdf.ts` — ветка `isWindow(d)`, всё остальное рисуется как проём;
- `storage.ts` — `isDoorway` / `isWallWindow` / копия элемента по виду;
- `main.ts` — кнопки `#tool-doorway` / `#tool-window`, `Tool`, `setDoorwayPanel` выбирает панель по `isWindow`.

На панели инструментов каждый инструмент — `.tool-anchor` с кнопкой и `.tool-panel` справа от неё. Групп инструментов пока нет. Внутренняя сторона `Side` в `doorway-faces.ts` — `1 | −1` по нормали `perp(d) = (−d.y, d.x)`. Сторона `left` из спецификации (`(d.y, −d.x)`) соответствует `Side = −1`.

## Goals / Non-Goals

**Goals:**
- дверь как третий вид элемента стены без дублирования правил проёма;
- группа «Проёмы» по существующему образцу «кнопка + вспомогательная панель» (`.claude/rules/ui.md`);
- обозначение двери — чистая геометрия, общая для холста и PDF.

**Non-Goals:**
- общий механизм групп для произвольных инструментов: группа одна, и абстракция появится, когда понадобится вторая;
- учёт полотна в попадании курсора, привязках и коллизиях.

## Decisions

### D1. Модель: `WallDoor` с `hinge` и `swing`
`interface WallDoor { kind: "door"; id; wallId; anchor; offsetCm; widthCm; heightCm; hinge: "a" | "b"; swing: "left" | "right" }`, а `WallElement = Doorway | WallWindow | WallDoor`, `isDoor`. Имена значений совпадают с форматом хранения (`drawing-storage`), поэтому сериализация остаётся копией полей вида, как у окна. Направление — два независимых поля, а не одно перечисление из 4 значений: каждое поле прямо входит в геометрию (D3), а цикл поворота (D4) задаётся таблицей.

Альтернатива — кодировать конец петель через `anchor`. Её отвергли: сторона привязки меняется при вводе расстояний, а направление меняться не должно (`door`, «Дверь — элемент стены»).

### D2. Правка двери в `doorway-edit.ts`
`placeDoor(wall, walls, raw, widthCm, heightCm, hinge, swing, id, elements)` строится по образцу `placeWindow`: прототип плюс общая логика установки. `rotateDoor(d): ElementEdit<WallDoor>` всегда возвращает `applied` со следующим направлением по таблице D4. `setHeight` / `setWidth` / `setDistance` / `slideDoorway` — обобщённые по `E extends WallElement`, поэтому поля `hinge` и `swing` сохраняются сами через spread. Сравнение «без изменений» (`sillOf` и т. п.) дополняется полями направления двери.

### D3. Геометрия двери — `doorLeaf()` в `doorway-layout.ts`
`doorLeaf(d: WallDoor, walls): DoorLeaf | null`, где `DoorLeaf = { leaf: Point[] /* 4 угла */, hinge: Point, radius: number, arcFrom: Point, arcTo: Point, side: Side }`, в см чертежа. Функция чистая и строится через `jambsT` и `hostPoint`:
- `tHinge` = откос у конца `hinge` (`j1` для `a`, `j2` для `b`), `tOther` — второй откос; `s` = `−1` для `left`, `+1` для `right`;
- `hinge = hostPoint(host, tHinge, s·T/2)`, `u` = `±d` от `tHinge` к `tOther`, `n = s·perp(d)`;
- `v = u·cos95° + n·sin95°`, `leafEnd = hinge + v·w`; толщина полотна `LEAF_CM = 4` откладывается от прямой `hinge → leafEnd` в сторону `−u'`, где `u'` — составляющая `u`, перпендикулярная `v` (вне сектора);
- `arcFrom = hinge + u·w`, `arcTo = leafEnd`.

Отрисовка на холсте и в PDF берёт углы дуги через `atan2` от `hinge` и выбирает направление обхода так, чтобы дуга шла через `n` (меньшая дуга, 95°). Вырез, грани и откосы двери рисуются той же веткой, что у проёма (`openingLines`). Полотно рисуется линиями контура `p.ink / m.contourPx`, дуга — `m.hatchPx`. Обрезка полотна по чужим стенам не делается (Non-Goals).

### D4. Таблица поворота
`nextDirection(direction)` в `element-kind.ts` — круг поворота: `a/left → b/left → b/right → a/right → a/left`. В том же файле лежат `elementDefaults("door")` = `{ widthCm: 90, heightCm: 210, hinge: "a", swing: "left" }` и `acceptField("door", ...)`, который принимает поля как у проёма.

### D5. Инструмент «Дверь» — тот же `createElementTool("door", ...)`
`ElementKind` расширяется до `"door"`. `ElementPanel` получает необязательный `rotate?: HTMLButtonElement`. По клику `rotate`: если `own()` — выделенная дверь, вызывается `apply(d, rotateDoor(d))` (одна запись истории), иначе меняется `params` направления без записи. Призрак строится `placeDoor` с текущими `params`, поэтому показывает направление. Функция `kindOf` становится тернарной по `kind`.

### D6. Группа «Проёмы» в DOM и `main.ts`
Разметка такая: `.tool-anchor` с кнопкой `#tool-openings` (новая SVG-иконка 24×24 в стиле `currentColor`, вид сбоку: проём со створкой) и одной `.tool-panel#openings-panel`. Внутри панели:
- ряд `.tool-group-switch` из двух кнопок `#tool-doorway` и `#tool-door` (иконки — существующая иконка проёма и новая иконка двери), стиль активной кнопки — как у `.wall-type.active`;
- два блока полей `#doorway-fields` и `#door-fields` (у двери — «Ширина», «H», кнопка «Повернуть» с иконкой поворота); виден блок текущего инструмента группы.

Логика группы — чистые функции переходов в `src/doorway/openings-group.ts` (без DOM, тестируемые):

```text
type GroupTool = "doorway" | "door"
interface GroupState { current: GroupTool; active: GroupTool | "other"; panelOpen: boolean }  // "other" — активен инструмент вне группы
groupButtonClick(s) -> GroupState   // active ≠ current: active = current, panelOpen = true; иначе panelOpen = !panelOpen
groupPick(s, t) -> GroupState       // current = t, active = t, panelOpen = true
groupSelect(s, kind) -> GroupState  // проём/дверь выделены: current = kind, panelOpen = true, active не меняется
groupButtonActive(s) -> boolean     // active !== "other"
```

`main.ts` хранит текущий инструмент группы и видимость панели (`openingsCurrent`, `openingsPanelOpen`); `active` выводится из `tool`, поэтому второй копии активного инструмента нет. `main.ts` собирает из них `GroupState`, применяет переходы и отражает результат в DOM: `setTool`, класс `open` панели, видимый блок полей, классы `active` кнопок. `setDoorwayPanel(open)` заменяется функцией `setElementPanel(open)`: по виду одиночного выделения (или по `tool`) открывает либо панель «Окно», либо панель группы с нужным блоком, и при выделении проёма или двери выставляет `openingsCurrent`. Активность кнопки группы — `tool === "doorway" || tool === "door"`. Объекты `doorwayTool` и `doorTool` получают одну и ту же `root` панели группы. Методы `setPanel` / `togglePanel` вызываются только через `main.ts` для панели группы целиком, а видимость блоков полей переключает `main.ts`.

### D7. Хранение и история
`storage.ts`: `isWallDoor(x)` = `kind === "door" && hasElementFields(x) && (hinge === "a" || hinge === "b") && (swing === "left" || swing === "right")`, `isWallElement` расширяется, копия по виду добавляет `hinge` и `swing`. `history.ts` использует те же проверки, поэтому битая дверь в снимке ломает структуру истории, как и требует спецификация. Версия документа не меняется: новый вид элемента читается старым кодом как неизвестный и отбрасывается, а это допустимо.

### D8. PDF
PDF рисуется общим `drawScene` с метриками PDF, поэтому ветка двери из `render.ts` действует и для PDF без повторения. `wallsBBox` добавляет к габаритам 4 угла полотна и точки дуги: `hinge ± n·w` и `hinge + u·w` (дуга лежит в квадрате `hinge ± w`, достаточно его углов со стороны `n`). Подпись двери учитывается как подпись проёма.

## Risks / Trade-offs

- [Ветки `else` после `isWindow` молча рисуют дверь как проём] → это сделано намеренно (вырез, грани и подпись общие). Полотно и дуга добавляются явной веткой `isDoor` после общей части, а тест отображения двери проверяет наличие дуги.
- [Подпись «H=…» может пересекаться с полотном, если сторона подписи совпала со стороной открывания] → пользователь согласился с правилом подписи проёма. Остаток записывается в `TODO.md` (Out of scope).
- [Полотно заходит на соседние стены и мебель] → это вне рамок по proposal.
- [Существующих тестов на порядок кнопок нет (поиск `tool-doorway` в `*.test.ts` пуст)] → тесты группы пишутся заново по `canvas-app` «Группа «Проёмы»».
- [Две панели (`doorwayTool` и `doorTool`) на одном `root`] → `setPanel` вызывается только из `main.ts`, а синхронизация полей идёт через `syncPanel` каждого инструмента по его блоку.

## Migration Plan

Миграция не нужна: формат версии 3 расширяется новым видом элемента. Откат возможен: старый код отбросит двери при загрузке, а остальные данные останутся.
