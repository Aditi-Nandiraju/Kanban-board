
# Kanban Board

A single-page, dependency-free Kanban board. Columns and cards persist in
the browser's `localStorage`, so your board is still there after a refresh.

## Files

| File | Purpose |
|---|---|
| [kanban-board.html](kanban-board.html) | Page markup — header, add-column form, and the `#board` mount point. Links `styles.css` and `script.js`. |
| [styles.css](styles.css) | All visual styling: layout, colors, card/column look, drag states. |
| [script.js](script.js) | All behavior: state management, rendering, drag-and-drop, persistence. |

## Running it

No build step or server needed — just open [kanban-board.html](kanban-board.html) directly in a browser.

## How it works

### State

The board's data lives in one `state` object with two parts:

```js
state = {
  columns: [ { id, title, cardIds: [...] }, ... ],
  cards: { [cardId]: { id, text } }
}
```

Columns hold an ordered list of card IDs (`cardIds`); the actual card content
lives in the `cards` lookup. This keeps card order and card data separate,
so reordering/moving a card is just an array operation, not a data copy.

On every change, `state` is serialized to `localStorage` under the key
`corkboard-kanban-state-v1` (`saveState()`), and re-read on page load
(`loadState()`). If nothing is saved yet, or the saved data is corrupt, a
small built-in `defaultState` (3 sample columns/cards) is used instead.

### Rendering

`render()` wipes and rebuilds the entire `#board` element from `state` on
every change — there's no diffing. Each column and its cards are plain
DOM elements built up in `renderColumn()` / `renderCard()` (no HTML
templating library).

### Columns

- **Add**: the header form (`#addColumnForm`) calls `addColumn(title)`,
  which pushes a new column with an empty `cardIds` array.
- **Delete**: the ✕ button on a column's tab calls `deleteColumn(id)`. If
  the column has cards, it confirms before deleting the column and all
  its cards.

### Cards

- **Add**: each column has its own add-card form (textarea + button).
  Enter submits (Shift+Enter for a newline); `addCard()` appends the new
  card to that column.
- **Edit**: the card's "Edit" button uses a `prompt()` to edit its text.
- **Delete**: the card's "Delete" button removes it from its column and
  from the `cards` lookup.

### Drag and drop

Cards are draggable (`draggable="true"`) using the native HTML5 Drag and
Drop API — no library.

- Dragging a card collapses its original slot immediately (`.dragging`
  collapses height/opacity to zero rather than using `display:none`,
  which would cancel the native drag in some browsers).
- Hovering over **any part of a column** (not just directly over a card)
  shows a dashed placeholder slot at the exact position the card would
  land, computed from cursor Y-position relative to existing cards
  (`getDragAfterElement()`).
- Dragging off a column without dropping removes the placeholder again
  (tracked via `dragleave`, checking `relatedTarget` so it only fires
  when the cursor truly leaves the column, not when moving between
  child elements inside it).
- Dropping calls `moveCard()`, which removes the card ID from its source
  column and inserts it at the placeholder's position in the target
  column (same column reordering works the same way).

### Status line

The footer briefly flashes "Saved ✓" (or an error) after every change,
via `flashStatus()`.
