# Test Suite

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| CLN-GREP-1 | Удалённые символы нигде не остались (test-plan: Requirements Coverage 1–2) | `src/geometry-cleanup.test.ts` | `remove-legacy-wall-geometry: мертвый код удалён > CLN-GREP-1: удалённые символы нигде не остались` | **FAIL (ожидаемо)** — violations: 19 вхождений: 11 в `geometry.ts` (все 11 имён, включая `distToSegment` и `snapVertex`), 8 в `geometry.test.ts` (handleAt, moveWall, pointOn, sameTypeJoint, wallDisplayPolys, pointInConvex, subtractCovered, snapVertex) |
| CLN-COVER-1 | Кейс «клин заливки попадает в позднюю стену» остаётся покрытым (test-plan: CLN-COVER-1) | `src/geometry-cleanup.test.ts` | `… > CLN-COVER-1: эквиваленты кейса «клин заливки попадает в позднюю стену» живы` | PASS |
| CLN-COVER-2 | Сценарии describe `moveWall` покрыты эквивалентами `moveWalls` (test-plan: CLN-COVER-2) | `src/geometry-cleanup.test.ts` | `… > CLN-COVER-2: сценарии describe moveWall покрыты эквивалентами moveWalls` | PASS |
| CLN-COVER-3 | Пять блоков `snapVertex` канонического модуля живы (test-plan: CLN-COVER-3) | `src/geometry-cleanup.test.ts` | `… > CLN-COVER-3: пять блоков snapVertex канонического модуля живы` | PASS |
| CLN-COVER-4 | Единственный тест живого `lockedDirection` переживает удаление `describe("snapVertex")` (test-plan: CLN-COVER-4, находка валидатора F1/R1) | `src/geometry-cleanup.test.ts` | `… > CLN-COVER-4: единственный тест живого lockedDirection пережил удаление describe snapVertex` | **FAIL (ожидаемо)** — `describe("lockedDirection"` в `geometry.test.ts` ещё не создан; создание контейнера и есть шаг реализации |
| CLN-TSC-1 | Компиляция без ссылок на удалённые символы (test-plan: Requirements Coverage 3) | команда: `npx tsc --noEmit` | — (gate) | PASS («TSC OK») |
| CLN-VITEST-1 | Живое поведение сохранено (test-plan: Requirements Coverage 4) | команда: `npx vitest run` | — (gate) | 214 passed / 2 failed — падают только ожидаемо-красные CLN-GREP-1 и CLN-COVER-4 (после реализации — все зелёные) |

Примечание к CLN-GREP-1: `snapVertex` проверяется с ограничением scope — вхождения запрещены только в `geometry.ts`/`geometry.test.ts`; канонический `wall-geometry.snapVertex` (wall-geometry.ts, wall-geometry.test.ts, main.ts) не затрагивается. Остальные 10 имён запрещены во всех файлах `src/**` кроме самого чекера. Всего violations в стартовом состоянии: 19 (11 в `geometry.ts`: все 11 имён, включая `distToSegment`; 8 в `geometry.test.ts`: handleAt, moveWall, pointOn, sameTypeJoint, wallDisplayPolys, pointInConvex, subtractCovered, snapVertex).

## Coverage

### Happy paths

- Реализация удаляет ровно перечисленное в violations CLN-GREP-1 → тест зеленеет; остальные 214 тестов остаются зелёными (CLN-VITEST-1).

### Boundary cases

- `moveWall` vs `moveWalls`: word-boundary regex `\bmoveWall\b` не матчит `moveWalls` — проверено прогоном (в списке violations только `moveWall`).
- `snapVertex` scope-ограничение: файл-чекер не матчит `wall-geometry.ts`/`main.ts` (прогон: их вхождения в violations не попали).

### Negative cases

- Мутант «удалён живой символ» (`wallShape`, `lockedDirection`, …): CLN-TSC-1 падает (импорты main.ts/render.ts, внутренние вызовы geometry.ts) + существующие тесты падают (CLN-VITEST-1).
- Мутант «удалено частично» (код без тестов или тесты без кода): CLN-GREP-1 остаётся красным.

### Invariants

- `wall-geometry.test.ts` не изменяется (охраняется CLN-COVER-1/3: имена блоков и ID кейсов должны остаться).
- Импорты и describe живых функций `geometry.test.ts` остаются (CLN-COVER-2).
- Кейс `lockedDirection` «направление от грани фиксируется точно перпендикулярно» сохраняется переносом в собственный `describe("lockedDirection")` без правок ассертов (CLN-COVER-4); это единственное разрешённое изменение живых тестов `geometry.test.ts`.

### Integration cases

- Полный `npx vitest run` после реализации: 7 файлов, 216 тестов — без падений.

## Unexpected Passes

- Нет. CLN-GREP-1 и CLN-COVER-4 красные до реализации (ожидаемо, red-before-green: первый требует удаления, второй — переноса кейса `lockedDirection` в собственный describe); CLN-COVER-1/2/3 зелёные до реализации — это охранные тесты, фиксирующие уже существующее покрытие, их зелёный статус — требование плана, не сюрприз.

## Tests That Could Not Run

- Нет.
