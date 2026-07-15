// ---------- exercise-library.js ----------
// Data layer on top of exercise-data.js (the read-only built-in dataset) and
// FTCore.data (localStorage-backed app state). Never mutates EXERCISE_DATABASE.
// Public API: window.ExerciseLibrary

(function () {
  const core = window.FTCore;
  const BUILTIN = window.EXERCISE_DATABASE || [];

  function customList() {
    return core.data.customExercises;
  }

  function getAll() {
    return BUILTIN.concat(customList());
  }

  function getById(id) {
    if (!id) return null;
    // custom list is short; check it first
    const custom = customList().find((e) => e.id === id);
    if (custom) return custom;
    return BUILTIN.find((e) => e.id === id) || null;
  }

  function isCustomId(id) {
    return customList().some((e) => e.id === id);
  }

  // ---------- fuzzy search ----------
  // Returns a match-quality TIER (5=exact ... 1=loose fuzzy subsequence), 0 for an
  // empty query (everyone matches equally), or null if the query doesn't match at all.
  // Deliberately coarse (plain integers): with this dataset's heavy near-duplicate/variant
  // naming noise, the community `rating` turns out to be a much better relevance signal
  // than word position once you're inside "the query matches a whole word" territory, so
  // rating (and a much smaller position nudge) is left to the combining step in search()
  // to break ties *within* a tier — it should never be able to jump an exercise a whole
  // tier, only nudge order among equally-well-matched ones.
  function fuzzyScore(name, query) {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!q) return 0;
    const n = name.toLowerCase();
    if (n === q) return 5;

    const nameWords = n.split(/[^a-z0-9]+/).filter(Boolean);
    if (nameWords.some((w) => w.startsWith(q))) return 4; // covers whole-string prefix too

    if (n.includes(q)) return 3;

    const queryWords = q.split(' ').filter(Boolean);
    if (queryWords.length > 1) {
      const allMatched = queryWords.every(
        (qw) => nameWords.some((w) => w.startsWith(qw)) || n.includes(qw)
      );
      if (allMatched) return 2;
    }

    // fuzzy subsequence fallback (loose/fast typing, e.g. "bnch prss")
    let qi = 0;
    for (let i = 0; i < n.length && qi < q.length; i++) {
      if (n[i] === q[qi]) qi++;
    }
    return qi === q.length ? 1 : null;
  }

  // Index (0-based) of the first name-word the query is a prefix of, or -1.
  // Used only as a minor tiebreaker within a tier, never to change the tier itself.
  function firstMatchWordIndex(name, query) {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return words.findIndex((w) => w.startsWith(q));
  }

  function matchesFilters(ex, filters) {
    if (filters.muscleGroup && ex.muscleGroup !== filters.muscleGroup) return false;
    if (filters.bodyPart && ex.bodyPart !== filters.bodyPart) return false;
    if (filters.equipment && ex.equipment !== filters.equipment) return false;
    if (filters.level && ex.level !== filters.level) return false;
    if (filters.favoritesOnly && !isFavorite(ex.id)) return false;
    return true;
  }

  // filters: { query, muscleGroup, bodyPart, equipment, level, favoritesOnly }
  function search(filters = {}) {
    const query = (filters.query || '').trim();
    const favIds = new Set(core.data.favoriteExerciseIds);
    const recentIndex = new Map(core.data.recentExerciseIds.map((id, i) => [id, i]));

    // Tier is multiplied up so it always dominates: worst case for the tiebreakers below
    // (favorite 5000 + recency ~1000 + rating ~2880) is still far below one tier step (1e7).
    const TIER_WEIGHT = 1e7;

    const results = [];
    getAll().forEach((ex) => {
      if (!matchesFilters(ex, filters)) return;
      let score = 0;
      if (query) {
        const tier = fuzzyScore(ex.name, query);
        if (tier === null) return;
        score = tier * TIER_WEIGHT;
      }
      if (favIds.has(ex.id)) score += 5000;
      if (recentIndex.has(ex.id)) score += (20 - Math.min(20, recentIndex.get(ex.id))) * 50;
      // Rating is the primary tiebreaker (empirically tracks relevance well on this dataset,
      // e.g. it alone ranks "Bench Press"/"Incline Bench Press" family above stray matches).
      if (typeof ex.rating === 'number') score += ex.rating * 300;
      // Word position is a much smaller nudge — mainly disambiguates the ~65% of exercises
      // with no community rating at all, without ever overriding a real rating difference.
      if (query) {
        const wordIdx = firstMatchWordIndex(ex.name, query);
        if (wordIdx !== -1) score += Math.max(0, 80 - wordIdx * 20);
      }
      score -= ex.name.length * 0.1; // final, near-invisible deterministic tiebreak
      results.push({ ex, score });
    });

    results.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
    return results.map((r) => r.ex);
  }

  function groupByMuscleGroup(list) {
    const groups = {};
    (window.EXERCISE_MUSCLE_GROUPS || []).forEach((g) => { groups[g] = []; });
    list.forEach((ex) => {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    });
    return groups;
  }

  // ---------- favorites ----------
  function isFavorite(id) {
    return core.data.favoriteExerciseIds.includes(id);
  }

  function toggleFavorite(id) {
    const list = core.data.favoriteExerciseIds;
    const idx = list.indexOf(id);
    let nowFavorite;
    if (idx === -1) { list.push(id); nowFavorite = true; }
    else { list.splice(idx, 1); nowFavorite = false; }
    core.saveData();
    return nowFavorite;
  }

  function getFavorites() {
    return core.data.favoriteExerciseIds
      .map((id) => getById(id))
      .filter(Boolean);
  }

  // ---------- recently used ----------
  const MAX_RECENT = 20;

  function markRecentlyUsed(id) {
    const list = core.data.recentExerciseIds;
    const idx = list.indexOf(id);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(id);
    if (list.length > MAX_RECENT) list.length = MAX_RECENT;
    core.saveData();
  }

  function getRecent(limit = 8) {
    return core.data.recentExerciseIds
      .map((id) => getById(id))
      .filter(Boolean)
      .slice(0, limit);
  }

  // ---------- custom exercises ----------
  function addCustomExercise(input) {
    const ex = {
      id: 'custom-' + core.uid(),
      name: (input.name || '').trim(),
      description: (input.instructions || input.description || '').trim(),
      type: 'Strength',
      bodyPart: (input.bodyPart || input.muscleGroup || 'Other').trim(),
      muscleGroup: input.muscleGroup || 'Other',
      equipment: (input.equipment || 'Other').trim() || 'Other',
      level: input.level || 'Intermediate',
      rating: null,
      ratingDesc: '',
      secondaryMuscles: [],
      imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
      gifUrl: null,
      custom: true,
      createdAt: Date.now(),
    };
    core.data.customExercises.push(ex);
    core.saveData();
    return ex;
  }

  function updateCustomExercise(id, patch) {
    const ex = customList().find((e) => e.id === id);
    if (!ex) return null;
    Object.assign(ex, patch, { id: ex.id, custom: true });
    core.saveData();
    return ex;
  }

  function deleteCustomExercise(id) {
    const list = core.data.customExercises;
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    // tidy up references so they don't linger forever
    core.data.favoriteExerciseIds = core.data.favoriteExerciseIds.filter((fid) => fid !== id);
    core.data.recentExerciseIds = core.data.recentExerciseIds.filter((rid) => rid !== id);
    core.saveData();
    return true;
  }

  // ---------- suggested exercises ----------
  function getSuggested(exercise, opts = {}) {
    const limit = opts.limit || 4;
    const exclude = new Set(opts.excludeIds || []);
    exclude.add(exercise.id);

    const scored = (pool) => pool
      .filter((e) => !exclude.has(e.id))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));

    const sameBodyPart = scored(getAll().filter((e) => e.bodyPart === exercise.bodyPart));
    if (sameBodyPart.length >= limit) return sameBodyPart.slice(0, limit);

    const sameGroup = scored(getAll().filter((e) => e.muscleGroup === exercise.muscleGroup));
    const combined = [...sameBodyPart];
    sameGroup.forEach((e) => {
      if (combined.length >= limit) return;
      if (!combined.some((c) => c.id === e.id)) combined.push(e);
    });
    return combined.slice(0, limit);
  }

  // ---------- history / PR / 1RM ----------
  function computeOneRepMax(weight, reps) {
    if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return Math.round(weight);
    return Math.round(weight * (1 + reps / 30));
  }

  function getHistory(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    const sets = core.data.workouts
      .filter((w) => w.exercise.toLowerCase() === key)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!sets.length) return null;

    const last = sets[sets.length - 1];
    const lastSessionSets = sets.filter((s) => s.date === last.date);
    let best = sets[0];
    let bestOneRM = 0;
    sets.forEach((s) => {
      const orm = computeOneRepMax(s.weight, s.reps);
      if (orm >= bestOneRM) { bestOneRM = orm; best = s; }
    });

    return {
      setCount: sets.length,
      lastWeight: last.weight,
      lastReps: last.reps,
      lastDate: last.date,
      lastSessionSetCount: lastSessionSets.length,
      bestWeight: best.weight,
      bestReps: best.reps,
      bestDate: best.date,
      estOneRM: bestOneRM,
    };
  }

  // ---------- facet value lists (built-in + anything introduced by custom exercises) ----------
  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function getMuscleGroups() {
    return window.EXERCISE_MUSCLE_GROUPS || [];
  }

  function getEquipmentValues() {
    return uniqueSorted((window.EXERCISE_EQUIPMENT_VALUES || []).concat(customList().map((e) => e.equipment)));
  }

  function getBodyPartValues() {
    return uniqueSorted((window.EXERCISE_BODY_PART_VALUES || []).concat(customList().map((e) => e.bodyPart)));
  }

  function getLevelValues() {
    return window.EXERCISE_LEVEL_VALUES || ['Beginner', 'Intermediate', 'Expert'];
  }

  window.ExerciseLibrary = {
    getAll,
    getById,
    isCustomId,
    search,
    fuzzyScore,
    groupByMuscleGroup,
    isFavorite,
    toggleFavorite,
    getFavorites,
    markRecentlyUsed,
    getRecent,
    addCustomExercise,
    updateCustomExercise,
    deleteCustomExercise,
    getSuggested,
    computeOneRepMax,
    getHistory,
    getMuscleGroups,
    getEquipmentValues,
    getBodyPartValues,
    getLevelValues,
  };
})();
