# Proposal: remove-legacy-wall-geometry

## Why

После изменения `2026-09-15-stable-wall-drawing` production (`main.ts`, `render.ts`) переключён на канонический модуль `src/wall-geometry.ts`. Старые двойники в `src/geometry.ts` остались только потому, что их пинили утверждённые тесты `geometry.test.ts` (Rule 4) — это зафиксировано в tasks.md той задачи (2.1–2.2): *«Старые findVertexSnap/snapVertex/orthoAxis/subtractCovered/wallDisplayPolys/sameTypeJoint/pointInConvex сохранены … production их не вызывает»*. Теперь, когда канонические реализации покрыты `wall-geometry.test.ts`, легаси можно убрать вместе с их тестами.

Исследование подтвердило: ~10 экспортов `geometry.ts` (~226 из 751 строк) не вызываются production — только тестами `geometry.test.ts` (~300 из 939 строк). Поведенчески это мертвый груз: два источника истины для снапа/формы стен усложняют навигацию и провоцируют правки не в том модуле.

## What Changes

- **Удаляются мертвые экспорты `geometry.ts`** (production не вызывает, пинят только тесты, покрытие перенесено в `wall-geometry.test.ts`):
  - `orthoAxis` — копия орто-логики; живые реализации — инлайн в `snap()` (geometry.ts:97-102) и `wall-geometry.snapVertex` (wall-geometry.ts:122-127);
  - `findVertexSnap`, `snapVertex` (старый) — заменены `wall-geometry.snapVertex`;
  - `handleAt` — prod использует `endpointAt`/`hitWall`;
  - `moveWall` — одиночный вариант `moveWalls`; все 5 тест-сценариев `moveWall` имеют эквиваленты в describe `moveWalls` (включая группу из одной стены);
  - `pointOn` — используется только тестами;
  - `sameTypeJoint` — шов теперь в `displayPolygons`/`contourSegments`;
  - `wallDisplayPolys` — заменён `wall-geometry.displayPolygons`;
  - `pointInConvex` — использовался только тестами `wallDisplayPolys`;
  - `subtractCovered` — заменён пайплайном `displayPolygons`;
  - непубличный `distToSegment` — умрёт вместе с единственным вызывающим `findVertexSnap`.
- **Удаляются тестовые блоки `geometry.test.ts`, пинящие мертвый код**: `handleAt`, `moveWall`, `snapVertex` (старый), `sameTypeJoint`, «полигоны отрисовки и заливка клина», `subtractCovered`, `pointOn`; импорты этих символов убираются.
- **Единственный кейс без прямого эквивалента** — «клин заливки попадает в позднюю стену» (hitWall по клину): перед удалением проверить покрытие в `wall-geometry.test.ts` («hitWall: попадание по отображаемой форме»); если кейса нет — перенести его туда в неизменном виде.

### Не трогается (проверено, живое)

- `lockedDirection` — main.ts:374 (в tasks.md 2.2 значился «легаси», но жив);
- `jointAt`, `wallShape`, `endCap`/`buttCap`/`capOnFaces`, `jointTol`, `jointedWalls`, `bodyGap` — живая внутренняя цепочка: `wallShape` → `wallSegments` → продовые `dimPointPoint`/`nearestEdgeIntersection`;
- `snap` (с инлайн-орто), `moveEndpoint`, `moveWalls`, `endpointAt`, `distanceToWall`, все dim*-функции, `zoomAt`, `visibleWorld`, `pointsEqual`, `segmentIntersectsRect`, `snapOthers`, реэкспорт `hitWall`;
- тестовые блоки «прилипание даёт чистые прямоугольники» и `wallShape` (пинят живое).

## Capabilities

### New Capabilities

_(нет — изменение поведенчески нейтрально)_

### Modified Capabilities

_(нет — ни одно требование спецификаций не меняется; спецификации не упоминают удаляемые функции по имени)_

## Impact

- `src/geometry.ts`: −~226 строк (751 → ~525);
- `src/geometry.test.ts`: −~300 строк (939 → ~640), чистка импортов;
- `src/wall-geometry.test.ts`: возможно +1 кейс (hitWall по клину), если он не покрыт;
- Поведение приложения, данные, формат хранения, история — без изменений;
- Проверка: `npm test` (vitest) и `tsc` (входит в `npm run build`) проходят.
