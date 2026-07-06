(function(){
  const STORAGE_KEY = 'corkboard-kanban-state-v1';

  const defaultState = {
    columns: [
      { id: 'col-todo', title: 'To Do', cardIds: ['card-1','card-2'] },
      { id: 'col-doing', title: 'In Progress', cardIds: ['card-3'] },
      { id: 'col-done', title: 'Done', cardIds: [] }
    ],
    cards: {
      'card-1': { id:'card-1', text:'Sketch the board layout' },
      'card-2': { id:'card-2', text:'Pick a color palette' },
      'card-3': { id:'card-3', text:'Wire up drag and drop' }
    }
  };

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      if(!parsed.columns || !parsed.cards) return structuredClone(defaultState);
      return parsed;
    }catch(e){
      console.warn('Could not read saved board, starting fresh.', e);
      return structuredClone(defaultState);
    }
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashStatus('Saved ✓');
    }catch(e){
      flashStatus('Could not save — storage may be full or unavailable.');
      console.error(e);
    }
  }

  let statusTimer;
  function flashStatus(msg){
    const el = document.getElementById('statusLine');
    el.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(()=>{ el.textContent=''; }, 1600);
  }

  let state = loadState();
  let idCounter = Date.now();
  function newId(prefix){ idCounter += 1; return prefix + '-' + idCounter; }

  const board = document.getElementById('board');
  let draggedCardId = null;
  let draggedFromColumn = null;

  let placeholder = null;
  function getPlaceholder(){
    if(!placeholder){
      placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder';
    }
    return placeholder;
  }
  function removePlaceholder(){
    if(placeholder && placeholder.parentElement){
      placeholder.parentElement.removeChild(placeholder);
    }
  }

  function render(){
    board.innerHTML = '';
    state.columns.forEach(col => {
      board.appendChild(renderColumn(col));
    });
  }

  function renderColumn(col){
    const colEl = document.createElement('section');
    colEl.className = 'column';
    colEl.dataset.columnId = col.id;

    const tab = document.createElement('div');
    tab.className = 'column-tab';
    tab.innerHTML = `
      <span>${escapeHtml(col.title)}</span>
      <span style="display:flex; align-items:center; gap:8px;">
        <span class="count">${col.cardIds.length}</span>
        <button class="col-delete" title="Delete column" aria-label="Delete column">✕</button>
      </span>`;
    tab.querySelector('.col-delete').addEventListener('click', () => deleteColumn(col.id));
    colEl.appendChild(tab);

    const list = document.createElement('div');
    list.className = 'card-list';
    list.dataset.columnId = col.id;

    if(col.cardIds.length === 0){
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = 'no cards yet';
      list.appendChild(hint);
    } else {
      col.cardIds.forEach((cardId, i) => {
        const card = state.cards[cardId];
        if(card) list.appendChild(renderCard(card, col.id, i));
      });
    }

    colEl.appendChild(list);
    colEl.appendChild(renderAddCardForm(col.id));

    colEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if(!draggedCardId) return;
      list.classList.add('drag-over');
      const hint = list.querySelector('.empty-hint');
      if(hint) hint.remove();
      const ph = getPlaceholder();
      const afterEl = getDragAfterElement(list, e.clientY);
      if(afterEl){
        list.insertBefore(ph, afterEl);
      } else {
        list.appendChild(ph);
      }
    });
    colEl.addEventListener('dragleave', (e) => {
      if(colEl.contains(e.relatedTarget)) return;
      list.classList.remove('drag-over');
      removePlaceholder();
      if(col.cardIds.length === 0 && !list.querySelector('.empty-hint')){
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = 'no cards yet';
        list.appendChild(hint);
      }
    });
    colEl.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      if(!draggedCardId) return;
      const ph = getPlaceholder();
      const beforeCardId = ph.parentElement === list && ph.nextElementSibling
        ? ph.nextElementSibling.dataset.cardId
        : null;
      removePlaceholder();
      moveCard(draggedCardId, draggedFromColumn, col.id, beforeCardId);
    });

    return colEl;
  }

  function renderCard(card, columnId, index){
    const el = document.createElement('article');
    el.className = 'card';
    el.draggable = true;
    el.dataset.cardId = card.id;

    const text = document.createElement('div');
    text.className = 'card-text';
    text.textContent = card.text;
    el.appendChild(text);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editCard(card.id));
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteCard(card.id, columnId));
    footer.appendChild(editBtn);
    footer.appendChild(delBtn);
    el.appendChild(footer);

    el.addEventListener('dragstart', () => {
      draggedCardId = card.id;
      draggedFromColumn = columnId;
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedCardId = null;
      draggedFromColumn = null;
      removePlaceholder();
      document.querySelectorAll('.card-list.drag-over').forEach(l => l.classList.remove('drag-over'));
    });

    return el;
  }

  function renderAddCardForm(columnId){
    const wrap = document.createElement('div');
    wrap.className = 'add-card-form';
    wrap.innerHTML = `
      <textarea placeholder="Write a card…" rows="2"></textarea>
      <div class="row">
        <button type="button" class="btn-primary add-card-btn">Add card</button>
      </div>`;
    const textarea = wrap.querySelector('textarea');
    const btn = wrap.querySelector('.add-card-btn');

    function submit(){
      const value = textarea.value.trim();
      if(!value) return;
      addCard(columnId, value);
      textarea.value = '';
      textarea.focus();
    }

    btn.addEventListener('click', submit);
    textarea.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        submit();
      }
    });

    return wrap;
  }

  function getDragAfterElement(container, y){
    const cards = [...container.querySelectorAll('.card:not(.dragging)')];
    return cards.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if(offset < 0 && offset > closest.offset){
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function addCard(columnId, text){
    const id = newId('card');
    state.cards[id] = { id, text };
    const col = state.columns.find(c => c.id === columnId);
    col.cardIds.push(id);
    saveState();
    render();
  }

  function editCard(cardId){
    const card = state.cards[cardId];
    const updated = prompt('Edit card text:', card.text);
    if(updated === null) return;
    const trimmed = updated.trim();
    if(!trimmed) return;
    card.text = trimmed;
    saveState();
    render();
  }

  function deleteCard(cardId, columnId){
    const col = state.columns.find(c => c.id === columnId);
    col.cardIds = col.cardIds.filter(id => id !== cardId);
    delete state.cards[cardId];
    saveState();
    render();
  }

  function moveCard(cardId, fromColumnId, toColumnId, beforeCardId){
    const fromCol = state.columns.find(c => c.id === fromColumnId);
    const toCol = state.columns.find(c => c.id === toColumnId);
    fromCol.cardIds = fromCol.cardIds.filter(id => id !== cardId);

    if(beforeCardId){
      const idx = toCol.cardIds.indexOf(beforeCardId);
      toCol.cardIds.splice(idx, 0, cardId);
    } else {
      toCol.cardIds.push(cardId);
    }
    saveState();
    render();
  }

  function addColumn(title){
    const id = newId('col');
    state.columns.push({ id, title, cardIds: [] });
    saveState();
    render();
  }

  function deleteColumn(columnId){
    const col = state.columns.find(c => c.id === columnId);
    if(col.cardIds.length > 0){
      const ok = confirm(`"${col.title}" has ${col.cardIds.length} card(s). Delete it and all its cards?`);
      if(!ok) return;
    }
    col.cardIds.forEach(id => delete state.cards[id]);
    state.columns = state.columns.filter(c => c.id !== columnId);
    saveState();
    render();
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById('addColumnForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newColumnInput');
    const value = input.value.trim();
    if(!value) return;
    addColumn(value);
    input.value = '';
  });

  render();
})();
