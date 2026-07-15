// ---------- workout-builder.js ----------
// The "Builder" tab: create/rename/duplicate/delete/reorder custom workout
// templates, add exercises via the reusable picker, configure sets/reps/
// weight/rest/RPE/notes per exercise, drag & drop to reorder, a muscle
// volume summary, a floating rest timer, per-exercise progress charts, and
// JSON import/export. Renders into #builder-root (added in index.html).

(function () {
  const Lib = window.ExerciseLibrary;
  const UI = window.UIUtils;
  const core = window.FTCore;
  const esc = core.escapeHtml;

  const state = { editingId: null };

  function templates() {
    return core.data.workoutTemplates;
  }

  function getTemplate(id) {
    return templates().find((t) => t.id === id) || null;
  }

  // ---------- generic drag & drop reorder helper ----------
  // Cards are `draggable="true"` as a whole (required by the DnD API — you drag the
  // element, not a sub-part of it), but they also contain text/number inputs. To keep
  // those inputs normally clickable/selectable, only a gesture starting on the
  // `.wb-drag-handle` is allowed to actually begin a drag; anything else cancels it.
  function makeSortable(container, itemSelector, onDrop) {
    let draggingEl = null;

    container.addEventListener('dragstart', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item || !container.contains(item)) return;
      if (!e.target.closest('.wb-drag-handle')) { e.preventDefault(); return; }
      draggingEl = item;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', item.dataset.uid || item.dataset.id || ''); } catch (err) { /* ignore */ }
      requestAnimationFrame(() => item.classList.add('dragging'));
    });

    container.addEventListener('dragend', () => {
      if (draggingEl) draggingEl.classList.remove('dragging');
      container.querySelectorAll(itemSelector).forEach((n) => n.classList.remove('drag-over-top', 'drag-over-bottom'));
      draggingEl = null;
    });

    container.addEventListener('dragover', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item || item === draggingEl || !draggingEl) return;
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      container.querySelectorAll(itemSelector).forEach((n) => n.classList.remove('drag-over-top', 'drag-over-bottom'));
      item.classList.add(before ? 'drag-over-top' : 'drag-over-bottom');
    });

    container.addEventListener('drop', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item || !draggingEl || item === draggingEl) return;
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      onDrop(draggingEl.dataset.uid || draggingEl.dataset.id, item.dataset.uid || item.dataset.id, before);
    });
  }

  function reorderById(list, idKey, draggedId, targetId, before) {
    const fromIdx = list.findIndex((x) => x[idKey] === draggedId);
    if (fromIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    let toIdx = list.findIndex((x) => x[idKey] === targetId);
    if (toIdx === -1) toIdx = list.length;
    list.splice(before ? toIdx : toIdx + 1, 0, moved);
  }

  // tap-friendly reorder (drag & drop needs a mouse — this is the touch-device
  // equivalent, wired to the same ▲/▼ buttons rendered next to the drag handle)
  function moveItem(list, idKey, id, direction) {
    const idx = list.findIndex((x) => x[idKey] === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(newIdx, 0, item);
  }

  function reorderBtnsHtml(id, isFirst, isLast) {
    return `<span class="wb-reorder-btns">
      <button type="button" class="wb-move-btn" data-action="move-up" data-id="${esc(id)}" aria-label="Move up" ${isFirst ? 'disabled' : ''}>▲</button>
      <button type="button" class="wb-move-btn" data-action="move-down" data-id="${esc(id)}" aria-label="Move down" ${isLast ? 'disabled' : ''}>▼</button>
    </span>`;
  }

  function wireMoveButtons(container, list, idKey, onMoved) {
    container.querySelectorAll('[data-action="move-up"]').forEach((btn) => {
      btn.addEventListener('click', () => { moveItem(list, idKey, btn.dataset.id, -1); onMoved(); });
    });
    container.querySelectorAll('[data-action="move-down"]').forEach((btn) => {
      btn.addEventListener('click', () => { moveItem(list, idKey, btn.dataset.id, 1); onMoved(); });
    });
  }

  // ---------- top-level render dispatch ----------
  function render() {
    const root = document.getElementById('builder-root');
    if (!root) return;
    const template = state.editingId ? getTemplate(state.editingId) : null;
    if (template) renderEditor(root, template);
    else { state.editingId = null; renderList(root); }
  }

  // ---------- template list view ----------
  function muscleChipSummary(template) {
    const totals = {};
    template.exercises.forEach((item) => {
      const ex = Lib.getById(item.exerciseId);
      const g = ex ? ex.muscleGroup : 'Other';
      totals[g] = (totals[g] || 0) + 1;
    });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<span class="muted">No exercises yet</span>';
    return entries.map(([g, n]) => `<span class="ep-badge">${esc(g)} ${n}</span>`).join('');
  }

  function templateCardHtml(t, isFirst, isLast) {
    return `
      <div class="wb-template-card" draggable="true" data-id="${esc(t.id)}">
        <span class="wb-drag-handle" title="Drag to reorder">⠿</span>
        ${reorderBtnsHtml(t.id, isFirst, isLast)}
        <button type="button" class="wb-template-info" data-action="open" data-id="${esc(t.id)}">
          <div class="wb-template-name">${esc(t.name)}</div>
          <div class="wb-template-meta">${t.exercises.length} exercise${t.exercises.length === 1 ? '' : 's'} &middot; ${muscleChipSummary(t)}</div>
        </button>
        <div class="wb-template-actions">
          <button type="button" data-action="rename" data-id="${esc(t.id)}" title="Rename">✎</button>
          <button type="button" data-action="duplicate" data-id="${esc(t.id)}" title="Duplicate">⧉</button>
          <button type="button" class="btn-danger-ghost" data-action="delete" data-id="${esc(t.id)}" title="Delete">×</button>
        </div>
      </div>`;
  }

  function renderList(root) {
    const list = templates();
    root.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h2>Your Workouts</h2>
          <button type="button" class="btn-primary" id="wb-new-template">+ New Workout</button>
        </div>
        <div class="wb-template-list" id="wb-template-list">
          ${list.length ? list.map((t, i) => templateCardHtml(t, i === 0, i === list.length - 1)).join('') : '<div class="chart-empty">No custom workouts yet — build one from any of the ' + Lib.getAll().length.toLocaleString() + ' exercises in the library.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Data</h2><span class="muted">everything is stored on this device</span></div>
        <div class="wb-data-actions">
          <button type="button" class="btn-secondary" id="wb-export">Export data (JSON)</button>
          <button type="button" class="btn-secondary" id="wb-import-btn">Import data (JSON)</button>
          <input type="file" id="wb-import-file" accept="application/json" hidden />
        </div>
      </div>`;

    root.querySelector('#wb-new-template').addEventListener('click', createTemplate);

    const listEl = root.querySelector('#wb-template-list');
    listEl.querySelectorAll('[data-action="open"]').forEach((btn) => {
      btn.addEventListener('click', () => { state.editingId = btn.dataset.id; render(); });
    });
    listEl.querySelectorAll('[data-action="rename"]').forEach((btn) => {
      btn.addEventListener('click', () => renameTemplateInline(btn));
    });
    listEl.querySelectorAll('[data-action="duplicate"]').forEach((btn) => {
      btn.addEventListener('click', () => duplicateTemplate(btn.dataset.id));
    });
    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
    });
    makeSortable(listEl, '.wb-template-card', (draggedId, targetId, before) => {
      reorderById(templates(), 'id', draggedId, targetId, before);
      core.saveData();
      render();
    });
    wireMoveButtons(listEl, templates(), 'id', () => { core.saveData(); render(); });

    root.querySelector('#wb-export').addEventListener('click', exportData);
    root.querySelector('#wb-import-btn').addEventListener('click', () => root.querySelector('#wb-import-file').click());
    root.querySelector('#wb-import-file').addEventListener('change', importData);
  }

  function createTemplate() {
    const t = { id: core.uid(), name: `Workout ${templates().length + 1}`, exercises: [], createdAt: Date.now(), updatedAt: Date.now() };
    templates().push(t);
    core.saveData();
    state.editingId = t.id;
    render();
    const nameInput = document.getElementById('wb-name-input');
    if (nameInput) { nameInput.focus(); nameInput.select(); }
  }

  function renameTemplateInline(btn) {
    const card = btn.closest('.wb-template-card');
    const t = getTemplate(btn.dataset.id);
    if (!t || !card) return;
    const infoBtn = card.querySelector('.wb-template-info');
    infoBtn.outerHTML = `<span class="wb-template-info wb-template-info-editing">
      <input type="text" class="wb-inline-rename" value="${esc(t.name)}" maxlength="60" />
    </span>`;
    const input = card.querySelector('.wb-inline-rename');
    input.focus();
    input.select();
    const commit = () => {
      t.name = input.value.trim() || t.name;
      t.updatedAt = Date.now();
      core.saveData();
      render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') render();
    });
    input.addEventListener('blur', commit);
  }

  function duplicateTemplate(id) {
    const t = getTemplate(id);
    if (!t) return;
    const copy = {
      id: core.uid(),
      name: `${t.name} copy`,
      exercises: t.exercises.map((item) => ({ ...item, uid: core.uid() })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const idx = templates().indexOf(t);
    templates().splice(idx + 1, 0, copy);
    core.saveData();
    UI.toast(`Duplicated "${t.name}"`, 'success');
    render();
  }

  function deleteTemplate(id) {
    const t = getTemplate(id);
    if (!t) return;
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    core.data.workoutTemplates = templates().filter((x) => x.id !== id);
    core.saveData();
    UI.toast('Workout deleted', 'info');
    render();
  }

  // ---------- template editor view ----------
  function renderVolumeSummary(template) {
    const el = document.getElementById('wb-volume-summary');
    if (!el) return;
    const totals = {};
    template.exercises.forEach((item) => {
      const ex = Lib.getById(item.exerciseId);
      const g = ex ? ex.muscleGroup : 'Other';
      totals[g] = (totals[g] || 0) + (Number(item.setsCount) || 0);
    });
    const entries = Object.entries(totals).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      el.innerHTML = '<div class="chart-empty">Add exercises to see your set volume per muscle group.</div>';
      return;
    }
    const max = entries[0][1];
    el.innerHTML = entries
      .map(([g, n]) => `
        <div class="goal-bar-row">
          <div class="goal-bar-label"><span>${esc(g)}</span><span>${n} set${n === 1 ? '' : 's'}</span></div>
          <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${Math.round((n / max) * 100)}%"></div></div>
        </div>`)
      .join('');
  }

  function historySnippetHtml(exerciseName) {
    const h = Lib.getHistory(exerciseName);
    if (!h) return '<div class="wb-history muted">No previous sets logged for this exercise yet.</div>';
    return `<div class="wb-history">
      <span>Previous: <strong>${h.lastWeight} × ${h.lastReps}</strong> (${h.lastSessionSetCount} set${h.lastSessionSetCount === 1 ? '' : 's'})</span>
      <span>PR: <strong>${h.bestWeight} × ${h.bestReps}</strong></span>
      <span>Est. 1RM: <strong>${h.estOneRM}</strong></span>
      <button type="button" class="wb-chart-link" data-action="chart">View progress</button>
    </div>`;
  }

  function exerciseCardHtml(item, ex, isFirst, isLast) {
    const badges = ex
      ? `<span class="ep-badge">${esc(ex.muscleGroup)}</span><span class="ep-badge">${esc(ex.equipment)}</span>`
      : '<span class="ep-badge">Unknown exercise</span>';
    return `
      <div class="wb-exercise-card" draggable="true" data-uid="${esc(item.uid)}">
        <div class="wb-exercise-head">
          <span class="wb-drag-handle" title="Drag to reorder">⠿</span>
          ${reorderBtnsHtml(item.uid, isFirst, isLast)}
          <div class="wb-exercise-title">
            <span class="wb-exercise-name">${esc(item.name)}</span>
            <span class="ep-row-badges">${badges}</span>
          </div>
          <div class="wb-exercise-actions">
            <button type="button" data-action="duplicate" title="Duplicate">⧉</button>
            <button type="button" class="btn-danger-ghost" data-action="delete" title="Remove">×</button>
          </div>
        </div>
        ${historySnippetHtml(item.name)}
        <div class="wb-exercise-fields">
          <label>Sets<input type="number" min="1" step="1" class="wb-f wb-f-sets" value="${item.setsCount}" /></label>
          <label>Reps<input type="text" class="wb-f wb-f-reps" value="${esc(item.repsTarget)}" placeholder="8-10" /></label>
          <label>Weight<input type="number" min="0" step="0.5" class="wb-f wb-f-weight" value="${esc(item.weightTarget)}" placeholder="target" /></label>
          <label>Rest (sec)<input type="number" min="0" step="5" class="wb-f wb-f-rest" value="${item.restSec}" /></label>
          <label>RPE<input type="number" min="1" max="10" step="0.5" class="wb-f wb-f-rpe" value="${esc(item.rpe)}" placeholder="—" /></label>
          <button type="button" class="wb-timer-btn" data-action="timer">▶ ${Number(item.restSec) || 0}s</button>
        </div>
        <div class="wb-quickset-row">
          ${['3×10', '4×8', '5×5', '3×12'].map((label) => {
            const [sets, reps] = label.split('×');
            return `<button type="button" class="chip" data-action="quickset" data-sets="${sets}" data-reps="${reps}">${label}</button>`;
          }).join('')}
        </div>
        <button type="button" class="wb-notes-toggle" data-action="toggle-notes">${item.notes ? 'Notes' : '+ Add notes'}</button>
        <textarea class="wb-f wb-f-notes" placeholder="Form cues, machine number, etc." ${item.notes ? '' : 'hidden'}>${esc(item.notes)}</textarea>
      </div>`;
  }

  function renderEditor(root, template) {
    const usedIds = new Set(template.exercises.map((i) => i.exerciseId));
    root.innerHTML = `
      <div class="card wb-editor-card">
        <div class="wb-editor-head">
          <button type="button" class="ep-back" id="wb-back">&larr; Back to workouts</button>
          <input type="text" id="wb-name-input" class="wb-name-input" value="${esc(template.name)}" maxlength="60" />
          <button type="button" class="btn-primary" id="wb-add-exercise">+ Add Exercise</button>
        </div>
        <div class="wb-exercise-list" id="wb-exercise-list">
          ${template.exercises.length
            ? template.exercises.map((item, i) => exerciseCardHtml(item, Lib.getById(item.exerciseId), i === 0, i === template.exercises.length - 1)).join('')
            : '<div class="chart-empty">No exercises yet. Click "+ Add Exercise" (or press /) to browse the library.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Muscle volume</h2><span class="muted">sets per muscle group in this workout</span></div>
        <div id="wb-volume-summary"></div>
      </div>`;

    root.querySelector('#wb-back').addEventListener('click', () => { state.editingId = null; render(); });

    const nameInput = root.querySelector('#wb-name-input');
    nameInput.addEventListener('input', () => { template.name = nameInput.value; });
    nameInput.addEventListener('blur', () => {
      template.name = nameInput.value.trim() || template.name;
      template.updatedAt = Date.now();
      core.saveData();
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

    root.querySelector('#wb-add-exercise').addEventListener('click', () => openPickerFor(template));

    wireExerciseList(root.querySelector('#wb-exercise-list'), template);
    renderVolumeSummary(template);
  }

  function openPickerFor(template) {
    window.ExercisePicker.open({
      title: 'Add Exercise',
      contextLabel: `Adding to: ${template.name}`,
      excludeIds: template.exercises.map((i) => i.exerciseId),
      onSelect: (ex) => {
        template.exercises.push({
          uid: core.uid(),
          exerciseId: ex.id,
          name: ex.name,
          setsCount: 3,
          repsTarget: '8-10',
          weightTarget: '',
          restSec: 90,
          rpe: '',
          notes: '',
        });
        template.updatedAt = Date.now();
        core.saveData();
        render();
      },
    });
  }

  function wireExerciseList(listEl, template) {
    listEl.querySelectorAll('.wb-exercise-card').forEach((card) => {
      const item = template.exercises.find((i) => i.uid === card.dataset.uid);
      if (!item) return;

      card.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
        const idx = template.exercises.indexOf(item);
        template.exercises.splice(idx + 1, 0, { ...item, uid: core.uid() });
        core.saveData();
        render();
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', () => {
        template.exercises = template.exercises.filter((i) => i.uid !== item.uid);
        core.saveData();
        render();
      });
      const chartBtn = card.querySelector('[data-action="chart"]');
      if (chartBtn) chartBtn.addEventListener('click', () => openProgressChart(item.name));

      const setsInput = card.querySelector('.wb-f-sets');
      const restInput = card.querySelector('.wb-f-rest');
      const timerBtn = card.querySelector('[data-action="timer"]');

      card.querySelector('.wb-f-sets').addEventListener('input', (e) => { item.setsCount = e.target.value; core.saveData(); });
      card.querySelector('.wb-f-reps').addEventListener('input', (e) => { item.repsTarget = e.target.value; core.saveData(); });
      card.querySelector('.wb-f-weight').addEventListener('input', (e) => { item.weightTarget = e.target.value; core.saveData(); });
      card.querySelector('.wb-f-rpe').addEventListener('input', (e) => { item.rpe = e.target.value; core.saveData(); });
      card.querySelector('.wb-f-notes').addEventListener('input', (e) => { item.notes = e.target.value; core.saveData(); });

      [setsInput].forEach((inp) => inp.addEventListener('change', () => renderVolumeSummary(template)));
      restInput.addEventListener('input', (e) => {
        item.restSec = e.target.value;
        core.saveData();
        timerBtn.textContent = `▶ ${Number(item.restSec) || 0}s`;
      });

      timerBtn.addEventListener('click', () => RestTimer.start(Number(item.restSec) || 60, item.name));

      card.querySelectorAll('[data-action="quickset"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          item.setsCount = Number(btn.dataset.sets);
          item.repsTarget = btn.dataset.reps;
          core.saveData();
          render();
        });
      });

      const notesToggle = card.querySelector('[data-action="toggle-notes"]');
      const notesArea = card.querySelector('.wb-f-notes');
      notesToggle.addEventListener('click', () => {
        notesArea.hidden = !notesArea.hidden;
        if (!notesArea.hidden) notesArea.focus();
      });
    });

    makeSortable(listEl, '.wb-exercise-card', (draggedId, targetId, before) => {
      reorderById(template.exercises, 'uid', draggedId, targetId, before);
      template.updatedAt = Date.now();
      core.saveData();
      render();
    });
    wireMoveButtons(listEl, template.exercises, 'uid', () => {
      template.updatedAt = Date.now();
      core.saveData();
      render();
    });
  }

  // ---------- per-exercise progress chart (reuses app.js's renderLineChart) ----------
  function openProgressChart(name) {
    const sets = core.data.workouts
      .filter((w) => w.exercise.toLowerCase() === name.toLowerCase())
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const points = sets.map((w) => ({ dateStr: w.date, value: w.weight }));
    UI.openModal({
      title: `${name} — weight over time`,
      bodyHtml: '<div id="wb-progress-chart" class="chart-wrap"></div>',
      onMount: (bodyEl) => {
        core.renderLineChart(bodyEl.querySelector('#wb-progress-chart'), points, { formatValue: (v) => `${v}` });
      },
    });
  }

  // ---------- floating rest timer widget ----------
  const RestTimer = (function () {
    const widget = document.createElement('div');
    widget.id = 'rest-timer-widget';
    widget.className = 'rest-timer-widget';
    widget.hidden = true;
    widget.innerHTML = `
      <div class="rt-label" id="rt-label"></div>
      <div class="rt-time" id="rt-time">0:00</div>
      <div class="rt-controls">
        <button type="button" id="rt-minus">-15s</button>
        <button type="button" id="rt-toggle">Pause</button>
        <button type="button" id="rt-plus">+15s</button>
        <button type="button" id="rt-close" aria-label="Close timer">×</button>
      </div>`;
    document.body.appendChild(widget);

    let remaining = 0;
    let paused = false;
    let intervalId = null;

    function tick() {
      if (paused) return;
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        render();
        widget.classList.add('rt-done');
        UI.toast('Rest finished — go!', 'success');
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        stop(2500);
        return;
      }
      render();
    }

    function render() {
      widget.querySelector('#rt-time').textContent = UI.formatMMSS(remaining);
      widget.classList.toggle('rt-warning', remaining > 0 && remaining <= 10);
    }

    function start(seconds, label) {
      clearInterval(intervalId);
      remaining = Math.max(1, Math.round(seconds));
      paused = false;
      widget.classList.remove('rt-done');
      widget.hidden = false;
      widget.querySelector('#rt-label').textContent = label || 'Rest';
      widget.querySelector('#rt-toggle').textContent = 'Pause';
      render();
      intervalId = setInterval(tick, 1000);
    }

    function stop(delay) {
      const doStop = () => { clearInterval(intervalId); intervalId = null; widget.hidden = true; widget.classList.remove('rt-done', 'rt-warning'); };
      if (delay) setTimeout(doStop, delay); else doStop();
    }

    widget.querySelector('#rt-toggle').addEventListener('click', () => {
      paused = !paused;
      widget.querySelector('#rt-toggle').textContent = paused ? 'Resume' : 'Pause';
    });
    widget.querySelector('#rt-plus').addEventListener('click', () => { remaining += 15; render(); });
    widget.querySelector('#rt-minus').addEventListener('click', () => { remaining = Math.max(0, remaining - 15); render(); });
    widget.querySelector('#rt-close').addEventListener('click', () => stop(0));

    return { start, stop };
  })();

  // ---------- import / export ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(core.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-tracker-export-${core.todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    UI.toast('Data exported', 'success');
  }

  function importData(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); } catch (err) { UI.toast('That file is not valid JSON', 'error'); return; }
      if (!parsed || !Array.isArray(parsed.workouts)) { UI.toast('That file does not look like a Fitness Tracker export', 'error'); return; }
      if (!confirm('Importing will REPLACE all data currently on this device. Continue?')) return;
      Object.keys(core.data).forEach((k) => delete core.data[k]);
      Object.assign(core.data, parsed);
      core.saveData();
      UI.toast('Data imported — reloading...', 'success');
      setTimeout(() => location.reload(), 700);
    };
    reader.readAsText(file);
  }

  // ---------- keyboard shortcut: "/" opens the picker while a workout is being edited ----------
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || !state.editingId) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const tabBtn = document.querySelector('.tab-btn[data-tab="builder"]');
    if (!tabBtn || !tabBtn.classList.contains('active')) return;
    e.preventDefault();
    const template = getTemplate(state.editingId);
    if (template) openPickerFor(template);
  });

  // ---------- init ----------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    if (btn.dataset.tab === 'builder') btn.addEventListener('click', render);
  });
  render();

  window.WorkoutBuilder = { render };
})();
