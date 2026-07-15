// ---------- browse-integration.js ----------
// Hooks the reusable Exercise Picker into the existing "Log a set" form's
// plain text input, as an ADDITION — the original text input + datalist +
// submit handler in app.js are untouched, so nothing about that form's
// existing behavior changes if this file is removed.

(function () {
  const input = document.getElementById('workout-exercise-input');
  const browseBtn = document.getElementById('workout-exercise-browse');
  if (!input || !browseBtn) return;

  browseBtn.addEventListener('click', () => {
    window.ExercisePicker.open({
      title: 'Choose Exercise',
      closeOnSelect: true,
      onSelect: (ex) => {
        input.value = ex.name;
        input.focus();
      },
    });
  });
})();
