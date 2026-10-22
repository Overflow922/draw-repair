## 1. Рисунок

- [x] 1.1 Тесты рисунка дивана по спеку: контур, подушки спинки, дуги, планка, диван другой глубины, узкий диван, масштаб деталей
- [x] 1.2 `sofaDrawing` по новому рисунку

## 2. Проверки

- [x] 2.1 Quality gates: `npx tsc --noEmit`, `npx vitest run --exclude ".claude/**" --exclude "node_modules/**"`, `openspec validate sofa-sketch-redraw --strict`, просмотр `git diff`
- [x] 2.2 Проверка в браузере: диван на плане и миниатюра в легенде
