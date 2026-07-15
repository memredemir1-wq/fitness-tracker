// ---------- exercise-picker.js ----------
// Reusable Exercise Picker: instant fuzzy search, filter facets, collapsible
// body-part groups, hover/focus details panel, suggested exercises, and
// custom-exercise creation. Renders into UIUtils' shared modal shell.
// Public API: window.ExercisePicker.open(options)
//
// options:
//   title          modal title (default "Add Exercise")
//   contextLabel   small subtitle, e.g. the workout name exercises are being added to
//   onSelect(ex)   called every time the user adds an exercise (picker stays open —
//                  users can add several exercises without reopening the modal)
//   closeOnSelect  if true, picker closes right after the first pick (used by the
//                  plain "Browse" button on the legacy single-exercise log form)
//   excludeIds     ids already present in the current context; picking one again
//                  still works but shows a duplicate-detection warning toast

(function () {
  const Lib = window.ExerciseLibrary;
  const UI = window.UIUtils;
  const core = window.FTCore;
  const esc = core.escapeHtml;

  const PAGE_SIZE = 60;
  let s = null; // session state, created fresh on each open()

  function open(options = {}) {
    const groupsOfBodyPart = new Map();
    Lib.getAll().forEach((ex) => groupsOfBodyPart.set(ex.bodyPart, ex.muscleGroup));

    s = {
      onSelect: options.onSelect || (() => {}),
      closeOnSelect: !!options.closeOnSelect,
      excludeIds: new Set(options.excludeIds || []),
      filters: { query: '', muscleGroup: '', bodyPart: '', equipment: '', level: '', favoritesOnly: false },
      expanded: new Set(),
      visibleCounts: {},
      flatVisibleCount: PAGE_SIZE,
      focusedId: null,
      bodyPartsByGroup: groupsOfBodyPart,
    };

    UI.openModal({
      title: options.title || 'Add Exercise',
      extraClass: 'modal-picker',
      bodyHtml: shellHtml(options.contextLabel),
      onMount: (bodyEl) => {
        s.bodyEl = bodyEl;
        wireShell(bodyEl);
        renderResults();
      },
      onClose: () => { s = null; },
    });
  }

  function shellHtml(contextLabel) {
    return `
      ${contextLabel ? `<div class="ep-context">${esc(contextLabel)}</div>` : ''}
      <div class="ep-searchrow">
        <input type="search" id="ep-search" class="ep-search" placeholder="Search exercises... (press / to focus)" autocomplete="off" />
        <button type="button" class="btn-secondary ep-new-btn" id="ep-new-exercise">+ New exercise</button>
      </div>
      <div class="ep-filters" id="ep-filters"></div>
      <div class="ep-layout">
        <div class="ep-results" id="ep-results" tabindex="-1"></div>
        <div class="ep-details" id="ep-details"><div class="ep-details-empty">Hover or select an exercise to see details</div></div>
      </div>`;
  }

  function filterSelectHtml(id, label, values, current) {
    const opts = ['<option value="">All ' + esc(label) + '</option>']
      .concat(values.map((v) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`));
    return `<select id="${id}" class="ep-filter-select" aria-label="${esc(label)}">${opts.join('')}</select>`;
  }

  function renderFilters() {
    const el = s.bodyEl.querySelector('#ep-filters');
    const bodyPartOptions = s.filters.muscleGroup
      ? Lib.getBodyPartValues().filter((bp) => s.bodyPartsByGroup.get(bp) === s.filters.muscleGroup)
      : Lib.getBodyPartValues();
    el.innerHTML = `
      ${filterSelectHtml('ep-f-group', 'Body Part', Lib.getMuscleGroups(), s.filters.muscleGroup)}
      ${filterSelectHtml('ep-f-bodypart', 'Target Muscle', bodyPartOptions, s.filters.bodyPart)}
      ${filterSelectHtml('ep-f-equipment', 'Equipment', Lib.getEquipmentValues(), s.filters.equipment)}
      ${filterSelectHtml('ep-f-level', 'Difficulty', Lib.getLevelValues(), s.filters.level)}
      <button type="button" class="pill ep-fav-toggle${s.filters.favoritesOnly ? ' active' : ''}" id="ep-f-fav">★ Favorites</button>
      <button type="button" class="ep-clear-filters" id="ep-f-clear">Clear</button>`;

    el.querySelector('#ep-f-group').addEventListener('change', (e) => {
      s.filters.muscleGroup = e.target.value;
      s.filters.bodyPart = ''; // reset narrower facet when the broader one changes
      resetPaging();
      renderFilters();
      renderResults();
    });
    el.querySelector('#ep-f-bodypart').addEventListener('change', (e) => {
      s.filters.bodyPart = e.target.value;
      resetPaging();
      renderResults();
    });
    el.querySelector('#ep-f-equipment').addEventListener('change', (e) => {
      s.filters.equipment = e.target.value;
      resetPaging();
      renderResults();
    });
    el.querySelector('#ep-f-level').addEventListener('change', (e) => {
      s.filters.level = e.target.value;
      resetPaging();
      renderResults();
    });
    el.querySelector('#ep-f-fav').addEventListener('click', () => {
      s.filters.favoritesOnly = !s.filters.favoritesOnly;
      resetPaging();
      renderFilters();
      renderResults();
    });
    el.querySelector('#ep-f-clear').addEventListener('click', () => {
      s.filters = { query: s.filters.query, muscleGroup: '', bodyPart: '', equipment: '', level: '', favoritesOnly: false };
      s.bodyEl.querySelector('#ep-search').value = s.filters.query;
      resetPaging();
      renderFilters();
      renderResults();
    });
  }

  function resetPaging() {
    s.expanded = new Set();
    s.visibleCounts = {};
    s.flatVisibleCount = PAGE_SIZE;
  }

  function wireShell(bodyEl) {
    renderFilters();

    const searchInput = bodyEl.querySelector('#ep-search');
    const debouncedSearch = UI.debounce(() => {
      s.filters.query = searchInput.value;
      resetPaging();
      renderResults();
    }, 90);
    searchInput.addEventListener('input', debouncedSearch);

    bodyEl.querySelector('#ep-new-exercise').addEventListener('click', () => openCustomExerciseForm());

    const results = bodyEl.querySelector('#ep-results');
    results.addEventListener('keydown', onResultsKeydown);
  }

  function isBrowseMode() {
    const f = s.filters;
    return !f.query && !f.muscleGroup && !f.bodyPart && !f.equipment && !f.level && !f.favoritesOnly;
  }

  function badgeHtml(ex) {
    const rating = typeof ex.rating === 'number' ? `<span class="ep-badge ep-badge-rating">★ ${ex.rating.toFixed(1)}</span>` : '';
    const customTag = ex.custom ? '<span class="ep-badge ep-badge-custom">Custom</span>' : '';
    return `${customTag}<span class="ep-badge">${esc(ex.equipment)}</span><span class="ep-badge">${esc(ex.level)}</span>${rating}`;
  }

  function rowHtml(ex) {
    const already = s.excludeIds.has(ex.id);
    const fav = Lib.isFavorite(ex.id);
    return `
      <div class="ep-row${already ? ' ep-row-added' : ''}" data-id="${esc(ex.id)}" role="option">
        <button type="button" class="ep-row-main" data-action="focus" data-id="${esc(ex.id)}">
          <span class="ep-row-name">${UI.highlightMatch(ex.name, s.filters.query)}</span>
          <span class="ep-row-badges">${badgeHtml(ex)}</span>
        </button>
        <button type="button" class="ep-row-fav${fav ? ' active' : ''}" data-action="fav" data-id="${esc(ex.id)}" title="${fav ? 'Remove favorite' : 'Add favorite'}" aria-label="Toggle favorite">${fav ? '★' : '☆'}</button>
        <button type="button" class="btn-primary ep-row-add" data-action="add" data-id="${esc(ex.id)}">${already ? 'Add again' : '+ Add'}</button>
      </div>`;
  }

  function groupSectionHtml(group, list) {
    const expanded = s.expanded.has(group);
    const visible = s.visibleCounts[group] || PAGE_SIZE;
    const shown = list.slice(0, visible);
    const remaining = list.length - shown.length;
    return `
      <div class="ep-group" data-group="${esc(group)}">
        <button type="button" class="ep-group-head" data-action="toggle-group" data-group="${esc(group)}">
          <span class="chevron">${expanded ? '▾' : '▸'}</span>
          <span class="ep-group-name">${esc(group)}</span>
          <span class="ep-group-count">${list.length}</span>
        </button>
        ${expanded ? `<div class="ep-group-body">
          ${shown.map(rowHtml).join('') || '<div class="ep-empty">No exercises match the current filters.</div>'}
          ${remaining > 0 ? `<button type="button" class="ep-show-more" data-action="more-group" data-group="${esc(group)}">Show ${Math.min(PAGE_SIZE, remaining)} more (${remaining} left)</button>` : ''}
        </div>` : ''}
      </div>`;
  }

  function pinnedSectionHtml(title, list) {
    if (!list.length) return '';
    return `<div class="ep-pinned"><div class="ep-pinned-title">${esc(title)}</div>${list.map(rowHtml).join('')}</div>`;
  }

  function renderResults() {
    const resultsEl = s.bodyEl.querySelector('#ep-results');
    const browse = isBrowseMode();

    if (browse) {
      const favorites = Lib.getFavorites();
      const recent = Lib.getRecent(8);
      const grouped = Lib.groupByMuscleGroup(Lib.getAll());
      const groupsHtml = Lib.getMuscleGroups()
        .filter((g) => (grouped[g] || []).length)
        .map((g) => groupSectionHtml(g, grouped[g]))
        .join('');
      resultsEl.innerHTML =
        pinnedSectionHtml('★ Favorites', favorites) +
        pinnedSectionHtml('🕐 Recently Used', recent) +
        `<div class="ep-all-label">All Exercises</div>` +
        groupsHtml;
    } else {
      const list = Lib.search(s.filters);
      if (s.filters.query) {
        const shown = list.slice(0, s.flatVisibleCount);
        const remaining = list.length - shown.length;
        resultsEl.innerHTML =
          `<div class="ep-result-count">${list.length} result${list.length === 1 ? '' : 's'}</div>` +
          (shown.map(rowHtml).join('') || '<div class="ep-empty">No exercises match "' + esc(s.filters.query) + '".</div>') +
          (remaining > 0 ? `<button type="button" class="ep-show-more" data-action="more-flat">Show ${Math.min(PAGE_SIZE, remaining)} more (${remaining} left)</button>` : '');
      } else {
        const grouped = Lib.groupByMuscleGroup(list);
        resultsEl.innerHTML = Lib.getMuscleGroups()
          .filter((g) => (grouped[g] || []).length)
          .map((g) => groupSectionHtml(g, grouped[g]))
          .join('') || '<div class="ep-empty">No exercises match the current filters.</div>';
      }
    }

    wireResultRows(resultsEl);
  }

  function wireResultRows(resultsEl) {
    resultsEl.querySelectorAll('[data-action="toggle-group"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        if (s.expanded.has(g)) s.expanded.delete(g); else s.expanded.add(g);
        renderResults();
      });
    });
    resultsEl.querySelectorAll('[data-action="more-group"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        s.visibleCounts[g] = (s.visibleCounts[g] || PAGE_SIZE) + PAGE_SIZE;
        renderResults();
      });
    });
    const moreFlat = resultsEl.querySelector('[data-action="more-flat"]');
    if (moreFlat) moreFlat.addEventListener('click', () => { s.flatVisibleCount += PAGE_SIZE; renderResults(); });

    resultsEl.querySelectorAll('.ep-row-main').forEach((btn) => {
      btn.addEventListener('mouseenter', () => focusRow(btn.dataset.id));
      btn.addEventListener('focus', () => focusRow(btn.dataset.id));
      btn.addEventListener('click', () => focusRow(btn.dataset.id));
    });
    resultsEl.querySelectorAll('[data-action="add"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ex = Lib.getById(btn.dataset.id);
        if (ex) selectExercise(ex);
      });
    });
    resultsEl.querySelectorAll('[data-action="fav"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nowFav = Lib.toggleFavorite(btn.dataset.id);
        btn.classList.toggle('active', nowFav);
        btn.textContent = nowFav ? '★' : '☆';
      });
    });
  }

  function visibleRowIds() {
    return Array.from(s.bodyEl.querySelectorAll('.ep-row-main')).map((b) => b.dataset.id);
  }

  function focusRow(id) {
    s.focusedId = id;
    s.bodyEl.querySelectorAll('.ep-row').forEach((r) => r.classList.toggle('ep-row-focused', r.dataset.id === id));
    const ex = Lib.getById(id);
    if (ex) renderDetails(ex);
  }

  function onResultsKeydown(e) {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
    const ids = visibleRowIds();
    if (!ids.length) return;
    e.preventDefault();
    if (e.key === 'Enter') {
      const ex = Lib.getById(s.focusedId || ids[0]);
      if (ex) selectExercise(ex);
      return;
    }
    let idx = ids.indexOf(s.focusedId);
    idx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
    idx = UI.clamp(idx, 0, ids.length - 1);
    focusRow(ids[idx]);
    const rowEl = s.bodyEl.querySelector(`.ep-row[data-id="${CSS.escape(ids[idx])}"]`);
    if (rowEl) rowEl.scrollIntoView({ block: 'nearest' });
  }

  function historyHtml(ex) {
    const h = Lib.getHistory(ex.name);
    if (!h) return '<div class="ep-history-empty">No logged history yet for this exercise.</div>';
    return `
      <div class="ep-history">
        <div class="ep-history-row"><span>Previous</span><strong>${h.lastWeight} × ${h.lastReps}</strong><span class="muted">${core.formatShortDate(h.lastDate)}</span></div>
        <div class="ep-history-row"><span>Personal record</span><strong>${h.bestWeight} × ${h.bestReps}</strong><span class="muted">${core.formatShortDate(h.bestDate)}</span></div>
        <div class="ep-history-row"><span>Est. 1RM</span><strong>${h.estOneRM}</strong><span class="muted">Epley formula</span></div>
      </div>`;
  }

  function renderDetails(ex) {
    const detailsEl = s.bodyEl.querySelector('#ep-details');
    const suggestions = Lib.getSuggested(ex, { limit: 4 });
    const preview = ex.imageUrl
      ? `<img class="ep-details-image" src="${esc(ex.imageUrl)}" alt="${esc(ex.name)}" />`
      : `<div class="ep-details-noimage">No preview image for this exercise</div>`;
    detailsEl.innerHTML = `
      ${preview}
      <h3 class="ep-details-title">${esc(ex.name)}</h3>
      <div class="ep-row-badges ep-details-badges">
        <span class="ep-badge">${esc(ex.muscleGroup)} &middot; ${esc(ex.bodyPart)}</span>
        <span class="ep-badge">${esc(ex.equipment)}</span>
        <span class="ep-badge">${esc(ex.level)}</span>
        ${typeof ex.rating === 'number' ? `<span class="ep-badge ep-badge-rating">★ ${ex.rating.toFixed(1)}</span>` : ''}
        ${ex.custom ? '<span class="ep-badge ep-badge-custom">Custom</span>' : ''}
      </div>
      <p class="ep-details-desc">${ex.description ? esc(ex.description) : '<span class="muted">No instructions provided.</span>'}</p>
      ${historyHtml(ex)}
      ${suggestions.length ? `
        <div class="ep-suggestions">
          <div class="ep-suggestions-label">Often paired with</div>
          <div class="ep-suggestions-chips">
            ${suggestions.map((sx) => `<button type="button" class="chip" data-id="${esc(sx.id)}">+ ${esc(sx.name)}</button>`).join('')}
          </div>
        </div>` : ''}
      <div class="ep-details-actions">
        <button type="button" class="btn-primary" data-action="add-details" data-id="${esc(ex.id)}">+ Add ${esc(ex.name)}</button>
        ${ex.custom ? `
          <button type="button" class="btn-secondary" data-action="edit-custom" data-id="${esc(ex.id)}">Edit</button>
          <button type="button" class="btn-danger" data-action="delete-custom" data-id="${esc(ex.id)}">Delete</button>` : ''}
      </div>`;

    detailsEl.querySelector('[data-action="add-details"]').addEventListener('click', () => selectExercise(ex));
    detailsEl.querySelectorAll('.ep-suggestions-chips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const sx = Lib.getById(chip.dataset.id);
        if (sx) selectExercise(sx);
      });
    });
    const editBtn = detailsEl.querySelector('[data-action="edit-custom"]');
    if (editBtn) editBtn.addEventListener('click', () => openCustomExerciseForm(ex));
    const delBtn = detailsEl.querySelector('[data-action="delete-custom"]');
    if (delBtn) delBtn.addEventListener('click', () => {
      if (!confirm(`Delete "${ex.name}"? This can't be undone.`)) return;
      Lib.deleteCustomExercise(ex.id);
      UI.toast('Exercise deleted', 'info');
      s.bodyEl.querySelector('#ep-details').innerHTML = '<div class="ep-details-empty">Hover or select an exercise to see details</div>';
      renderResults();
    });
  }

  function selectExercise(ex) {
    if (s.excludeIds.has(ex.id)) {
      UI.toast(`⚠️ ${ex.name} is already in this workout — added again`, 'warn');
    } else {
      UI.toast(`Added ${ex.name}`, 'success');
    }
    s.excludeIds.add(ex.id);
    Lib.markRecentlyUsed(ex.id);
    s.onSelect(ex);
    if (s.closeOnSelect) {
      UI.closeModal();
      return;
    }
    renderResults();
    renderDetails(ex);
  }

  // ---------- custom exercise creation / edit ----------
  function customFormHtml(existing) {
    const groupOptions = Lib.getMuscleGroups()
      .map((g) => `<option value="${esc(g)}"${existing && existing.muscleGroup === g ? ' selected' : ''}>${esc(g)}</option>`)
      .join('');
    const equipmentListId = 'ep-equipment-list';
    return `
      <button type="button" class="ep-back" id="ep-form-back">&larr; Back to browse</button>
      <form id="ep-custom-form" class="ep-custom-form">
        <label>Exercise name
          <input type="text" name="name" required maxlength="80" value="${esc(existing ? existing.name : '')}" placeholder="e.g. Cable Y-Raise" />
        </label>
        <label>Body part
          <select name="muscleGroup" required>${groupOptions}</select>
        </label>
        <label>Target muscle
          <input type="text" name="bodyPart" list="ep-bodypart-list" maxlength="40" value="${esc(existing ? existing.bodyPart : '')}" placeholder="e.g. Rear Deltoid" />
          <datalist id="ep-bodypart-list">${Lib.getBodyPartValues().map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
        </label>
        <label>Equipment
          <input type="text" name="equipment" list="${equipmentListId}" maxlength="40" value="${esc(existing ? existing.equipment : '')}" placeholder="e.g. Cable" />
          <datalist id="${equipmentListId}">${Lib.getEquipmentValues().map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
        </label>
        <label>Difficulty
          <select name="level">
            ${Lib.getLevelValues().map((v) => `<option value="${esc(v)}"${existing && existing.level === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}
          </select>
        </label>
        <label class="ep-form-span">Instructions
          <textarea name="instructions" rows="3" placeholder="How to perform it, cues, tempo...">${esc(existing ? existing.description : '')}</textarea>
        </label>
        <label class="ep-form-span">Image URL (optional)
          <input type="url" name="imageUrl" value="${esc(existing && existing.imageUrl ? existing.imageUrl : '')}" placeholder="https://..." />
        </label>
        <div class="ep-form-actions">
          <button type="submit" class="btn-primary">${existing ? 'Save changes' : 'Create exercise'}</button>
        </div>
      </form>`;
  }

  function openCustomExerciseForm(existing) {
    s.bodyEl.innerHTML = customFormHtml(existing);
    s.bodyEl.querySelector('#ep-form-back').addEventListener('click', () => {
      s.bodyEl.innerHTML = shellHtml();
      wireShell(s.bodyEl);
      renderResults();
    });
    s.bodyEl.querySelector('#ep-custom-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const input = {
        name: fd.get('name'),
        muscleGroup: fd.get('muscleGroup'),
        bodyPart: fd.get('bodyPart'),
        equipment: fd.get('equipment'),
        level: fd.get('level'),
        instructions: fd.get('instructions'),
        imageUrl: fd.get('imageUrl'),
      };
      if (!input.name.trim()) return;
      const saved = existing
        ? Lib.updateCustomExercise(existing.id, {
            name: input.name.trim(),
            muscleGroup: input.muscleGroup,
            bodyPart: input.bodyPart.trim() || input.muscleGroup,
            equipment: input.equipment.trim() || 'Other',
            level: input.level,
            description: input.instructions.trim(),
            imageUrl: input.imageUrl.trim() || null,
          })
        : Lib.addCustomExercise(input);
      UI.toast(existing ? 'Exercise updated' : 'Custom exercise created', 'success');
      s.bodyEl.innerHTML = shellHtml();
      wireShell(s.bodyEl);
      renderResults();
      focusRow(saved.id);
    });
  }

  window.ExercisePicker = { open };
})();
