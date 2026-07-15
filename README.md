# Fitness Tracker

A free, personal workout & nutrition tracker — no account, no ads, no backend.

### 👉 [Open the app](https://memredemir1-wq.github.io/fitness-tracker/)

On iPhone/Android: open the link above, then use your browser's **Share → Add to Home Screen** to install it like a real app.

## What it does

- **Dashboard** — body weight, calories, and workout volume charts
- **Program** — built-in 4-day and 6-day workout splits, plus any custom workouts you build
- **Builder** — create your own workouts from a searchable library of ~2,900 exercises: sets, reps, weight, rest, RPE, notes, drag-and-drop (or tap ▲▼ on mobile) reordering, muscle-volume summary, rest timer
- **Workouts** — log sets, body weight, and cardio
- **Diet** — log meals and track macros against your targets

## Your data stays yours

There's no server and no login — everything you log is stored only in your own browser (localStorage). Nobody else who opens this link can see your data, and you won't see theirs. You can export/import a backup as JSON from the Builder tab's "Data" card.

## Running it locally

It's fully static — no build step. Clone the repo and open `index.html`, or serve it with any static file server, e.g.:

```
python3 -m http.server 8000
```
