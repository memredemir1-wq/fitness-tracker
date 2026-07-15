// ---------- storage ----------
const STORAGE_KEY = 'fitnessTrackerData';

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      workouts: parsed?.workouts || [],
      meals: parsed?.meals || [],
      bodyweight: parsed?.bodyweight || [],
      cardio: parsed?.cardio || [],
      exerciseWeights: parsed?.exerciseWeights || {},
      exercisePlans: parsed?.exercisePlans || {},
      todayLog: parsed?.todayLog || null,
      settings: { splitKey: '4day', dayIndex: 0, ...(parsed?.settings || {}) },
      // exercise library + workout builder additions (kept in the same store/save cycle)
      customExercises: parsed?.customExercises || [],
      favoriteExerciseIds: parsed?.favoriteExerciseIds || [],
      recentExerciseIds: parsed?.recentExerciseIds || [],
      workoutTemplates: parsed?.workoutTemplates || [],
    };
  } catch (e) {
    return {
      workouts: [],
      meals: [],
      bodyweight: [],
      cardio: [],
      exerciseWeights: {},
      exercisePlans: {},
      todayLog: null,
      settings: { splitKey: '4day', dayIndex: 0 },
      customExercises: [],
      favoriteExerciseIds: [],
      recentExerciseIds: [],
      workoutTemplates: [],
    };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let data = loadData();

// ---------- nutrition goals (from the user's program doc) ----------
const GOALS = { calories: 2450, protein: 192, carbs: 255, fat: 72 };

// ---------- built-in food nutrition estimates (EN + TR keywords) ----------
// 'per100g' entries scale with a detected gram quantity (default 100g).
// 'perUnit' entries represent one typical serving/piece and scale with a detected count (default 1).
const FOOD_DB = [
  { name: 'Chicken Breast', keywords: ['chicken breast', 'chicken', 'tavuk göğsü', 'tavuk'], calories: 165, protein: 31, carbs: 0, fat: 3.6, basis: 'per100g' },
  { name: 'Chicken Thigh', keywords: ['chicken thigh', 'tavuk but'], calories: 209, protein: 26, carbs: 0, fat: 10.9, basis: 'per100g' },
  { name: 'Grilled Chicken Breast', keywords: ['grilled chicken breast', 'grilled chicken', 'ızgara tavuk göğsü', 'ızgara tavuk'], calories: 172, protein: 29, carbs: 0, fat: 4.5, basis: 'per100g' },
  { name: 'Fried Chicken', keywords: ['fried chicken', 'kızarmış tavuk'], calories: 290, protein: 19, carbs: 15, fat: 18, basis: 'per100g' },
  { name: 'Chicken Wings', keywords: ['chicken wings', 'chicken wing', 'tavuk kanat'], calories: 290, protein: 27, carbs: 0, fat: 19, basis: 'per100g' },
  { name: 'Rotisserie Chicken', keywords: ['rotisserie chicken', 'çevirme tavuk', 'fırın tavuk'], calories: 239, protein: 27, carbs: 0, fat: 14, basis: 'per100g' },
  { name: 'Ground Beef', keywords: ['ground beef', 'kıyma', 'köfte'], calories: 250, protein: 26, carbs: 0, fat: 17, basis: 'per100g' },
  { name: 'Steak', keywords: ['steak', 'beef', 'kırmızı et', 'dana eti'], calories: 271, protein: 25, carbs: 0, fat: 19, basis: 'per100g' },
  { name: 'Salmon', keywords: ['salmon', 'somon'], calories: 208, protein: 20, carbs: 0, fat: 13, basis: 'per100g' },
  { name: 'Tuna', keywords: ['tuna', 'ton balığı', 'ton balik'], calories: 132, protein: 28, carbs: 0, fat: 1.3, basis: 'per100g' },
  { name: 'Fish', keywords: ['fish', 'balık'], calories: 140, protein: 24, carbs: 0, fat: 5, basis: 'per100g' },
  { name: 'Egg', keywords: ['egg', 'yumurta'], calories: 78, protein: 6.5, carbs: 0.6, fat: 5.3, basis: 'perUnit' },
  { name: 'Greek Yogurt', keywords: ['greek yogurt', 'süzme yoğurt', 'yogurt', 'yoğurt'], calories: 100, protein: 17, carbs: 6, fat: 0.7, basis: 'per100g' },
  { name: 'Cheese', keywords: ['cheese', 'peynir'], calories: 110, protein: 7, carbs: 1, fat: 9, basis: 'perUnit' },
  { name: 'Milk', keywords: ['milk', 'süt'], calories: 103, protein: 8, carbs: 12, fat: 2.4, basis: 'perUnit' },
  { name: 'Rice', keywords: ['rice', 'pirinç', 'pilav'], calories: 205, protein: 4.3, carbs: 45, fat: 0.4, basis: 'perUnit' },
  { name: 'Pasta', keywords: ['pasta', 'makarna'], calories: 220, protein: 8, carbs: 43, fat: 1.3, basis: 'perUnit' },
  { name: 'Oatmeal', keywords: ['oats', 'oatmeal', 'yulaf'], calories: 150, protein: 5, carbs: 27, fat: 3, basis: 'perUnit' },
  { name: 'Bread', keywords: ['bread', 'ekmek'], calories: 80, protein: 3, carbs: 15, fat: 1, basis: 'perUnit' },
  { name: 'Sweet Potato', keywords: ['sweet potato', 'tatlı patates'], calories: 112, protein: 2, carbs: 26, fat: 0.1, basis: 'perUnit' },
  { name: 'Potato', keywords: ['potato', 'patates'], calories: 163, protein: 4.3, carbs: 37, fat: 0.2, basis: 'perUnit' },
  { name: 'Broccoli', keywords: ['broccoli', 'brokoli'], calories: 55, protein: 3.7, carbs: 11, fat: 0.6, basis: 'perUnit' },
  { name: 'Salad', keywords: ['vegetable', 'sebze', 'salata', 'salad'], calories: 50, protein: 2, carbs: 10, fat: 0.3, basis: 'perUnit' },
  { name: 'Banana', keywords: ['banana', 'muz'], calories: 105, protein: 1.3, carbs: 27, fat: 0.4, basis: 'perUnit' },
  { name: 'Apple', keywords: ['apple', 'elma'], calories: 95, protein: 0.5, carbs: 25, fat: 0.3, basis: 'perUnit' },
  { name: 'Avocado', keywords: ['avocado', 'avokado'], calories: 240, protein: 3, carbs: 13, fat: 22, basis: 'perUnit' },
  { name: 'Almonds', keywords: ['almond', 'badem'], calories: 164, protein: 6, carbs: 6, fat: 14, basis: 'perUnit' },
  { name: 'Walnuts', keywords: ['walnut', 'ceviz'], calories: 185, protein: 4.3, carbs: 4, fat: 18, basis: 'perUnit' },
  { name: 'Peanut Butter', keywords: ['peanut butter', 'fıstık ezmesi'], calories: 190, protein: 8, carbs: 6, fat: 16, basis: 'perUnit' },
  { name: 'Olive Oil', keywords: ['olive oil', 'zeytinyağı'], calories: 119, protein: 0, carbs: 0, fat: 14, basis: 'perUnit' },
  { name: 'Protein Powder', keywords: ['protein powder', 'whey', 'protein tozu'], calories: 120, protein: 24, carbs: 3, fat: 1, basis: 'perUnit' },
  { name: 'Lentils', keywords: ['lentil', 'mercimek'], calories: 230, protein: 18, carbs: 40, fat: 0.8, basis: 'perUnit' },
  { name: 'Chickpeas', keywords: ['chickpea', 'nohut'], calories: 269, protein: 15, carbs: 45, fat: 4.2, basis: 'perUnit' },
  { name: 'Quinoa', keywords: ['quinoa'], calories: 222, protein: 8, carbs: 39, fat: 3.6, basis: 'perUnit' },
  { name: 'Hummus', keywords: ['hummus'], calories: 166, protein: 8, carbs: 14, fat: 10, basis: 'per100g' },
  // more protein sources
  { name: 'Turkey Breast', keywords: ['turkey breast', 'hindi göğsü', 'hindi'], calories: 135, protein: 30, carbs: 0, fat: 1, basis: 'per100g' },
  { name: 'Shrimp', keywords: ['shrimp', 'karides'], calories: 99, protein: 24, carbs: 0.2, fat: 0.3, basis: 'per100g' },
  { name: 'Tofu', keywords: ['tofu'], calories: 76, protein: 8, carbs: 1.9, fat: 4.8, basis: 'per100g' },
  { name: 'Sausage', keywords: ['sausage', 'sosis'], calories: 300, protein: 12, carbs: 3, fat: 27, basis: 'per100g' },
  { name: 'Feta Cheese', keywords: ['beyaz peynir', 'feta'], calories: 264, protein: 18, carbs: 3, fat: 21, basis: 'per100g' },
  { name: 'Cottage Cheese', keywords: ['cottage cheese', 'lor peyniri', 'lor'], calories: 98, protein: 11, carbs: 3.4, fat: 4.3, basis: 'per100g' },
  { name: 'Ayran', keywords: ['ayran'], calories: 70, protein: 3, carbs: 5, fat: 3.5, basis: 'perUnit' },
  // legumes & grains
  { name: 'Black Beans', keywords: ['black beans', 'siyah fasulye'], calories: 227, protein: 15, carbs: 41, fat: 0.9, basis: 'perUnit' },
  { name: 'White Beans', keywords: ['kuru fasulye', 'white beans', 'beyaz fasulye'], calories: 300, protein: 15, carbs: 45, fat: 6, basis: 'perUnit' },
  { name: 'Bulgur', keywords: ['bulgur'], calories: 180, protein: 6.5, carbs: 38, fat: 0.5, basis: 'perUnit' },
  { name: 'Couscous', keywords: ['couscous'], calories: 176, protein: 6, carbs: 36, fat: 0.3, basis: 'perUnit' },
  { name: 'Corn', keywords: ['corn', 'mısır'], calories: 132, protein: 5, carbs: 29, fat: 2, basis: 'perUnit' },
  { name: 'Granola', keywords: ['granola'], calories: 200, protein: 5, carbs: 30, fat: 8, basis: 'perUnit' },
  // vegetables
  { name: 'Spinach', keywords: ['spinach', 'ıspanak'], calories: 41, protein: 5, carbs: 7, fat: 0.5, basis: 'perUnit' },
  { name: 'Carrot', keywords: ['carrot', 'havuç'], calories: 25, protein: 0.6, carbs: 6, fat: 0.1, basis: 'perUnit' },
  { name: 'Cucumber', keywords: ['cucumber', 'salatalık'], calories: 45, protein: 2, carbs: 11, fat: 0.3, basis: 'perUnit' },
  { name: 'Tomato', keywords: ['tomato', 'domates'], calories: 22, protein: 1, carbs: 5, fat: 0.2, basis: 'perUnit' },
  { name: 'Onion', keywords: ['onion', 'soğan'], calories: 44, protein: 1.2, carbs: 10, fat: 0.1, basis: 'perUnit' },
  { name: 'Bell Pepper', keywords: ['pepper', 'biber'], calories: 24, protein: 1, carbs: 6, fat: 0.2, basis: 'perUnit' },
  { name: 'Olives', keywords: ['zeytin', 'olives', 'olive'], calories: 50, protein: 0.3, carbs: 3, fat: 4.5, basis: 'perUnit' },
  // fruits
  { name: 'Orange', keywords: ['orange', 'portakal'], calories: 62, protein: 1.2, carbs: 15, fat: 0.2, basis: 'perUnit' },
  { name: 'Grapes', keywords: ['grapes', 'üzüm'], calories: 104, protein: 1, carbs: 27, fat: 0.2, basis: 'perUnit' },
  { name: 'Watermelon', keywords: ['watermelon', 'karpuz'], calories: 46, protein: 1, carbs: 11.5, fat: 0.2, basis: 'perUnit' },
  { name: 'Strawberry', keywords: ['strawberry', 'çilek'], calories: 49, protein: 1, carbs: 12, fat: 0.5, basis: 'perUnit' },
  { name: 'Pineapple', keywords: ['pineapple', 'ananas'], calories: 82, protein: 0.9, carbs: 22, fat: 0.2, basis: 'perUnit' },
  { name: 'Mandarin', keywords: ['mandarin', 'mandalina'], calories: 47, protein: 0.7, carbs: 12, fat: 0.3, basis: 'perUnit' },
  { name: 'Kiwi', keywords: ['kiwi'], calories: 42, protein: 0.8, carbs: 10, fat: 0.4, basis: 'perUnit' },
  { name: 'Fig', keywords: ['fig', 'incir'], calories: 37, protein: 0.4, carbs: 10, fat: 0.1, basis: 'perUnit' },
  // fats & spreads
  { name: 'Honey', keywords: ['bal', 'honey'], calories: 64, protein: 0, carbs: 17, fat: 0, basis: 'perUnit' },
  { name: 'Jam', keywords: ['reçel', 'jam'], calories: 50, protein: 0, carbs: 13, fat: 0, basis: 'perUnit' },
  { name: 'Butter', keywords: ['butter', 'tereyağı'], calories: 102, protein: 0.1, carbs: 0, fat: 11.5, basis: 'perUnit' },
  // Turkish dishes & bakery
  { name: 'Döner', keywords: ['döner', 'doner'], calories: 250, protein: 18, carbs: 12, fat: 15, basis: 'per100g' },
  { name: 'Lahmacun', keywords: ['lahmacun'], calories: 285, protein: 11, carbs: 40, fat: 9, basis: 'perUnit' },
  { name: 'Pide', keywords: ['pide'], calories: 300, protein: 10, carbs: 45, fat: 8, basis: 'perUnit' },
  { name: 'Mantı', keywords: ['mantı'], calories: 450, protein: 20, carbs: 55, fat: 15, basis: 'perUnit' },
  { name: 'Lentil Soup', keywords: ['mercimek çorbası', 'lentil soup'], calories: 150, protein: 8, carbs: 22, fat: 3, basis: 'perUnit' },
  { name: 'Soup', keywords: ['çorba', 'soup'], calories: 120, protein: 5, carbs: 15, fat: 4, basis: 'perUnit' },
  { name: 'Simit', keywords: ['simit'], calories: 300, protein: 10, carbs: 52, fat: 6, basis: 'perUnit' },
  { name: 'Poğaça', keywords: ['poğaça'], calories: 280, protein: 6, carbs: 34, fat: 13, basis: 'perUnit' },
  { name: 'Börek', keywords: ['börek'], calories: 320, protein: 9, carbs: 30, fat: 18, basis: 'perUnit' },
  { name: 'Baklava', keywords: ['baklava'], calories: 330, protein: 5, carbs: 40, fat: 18, basis: 'perUnit' },
  { name: 'Künefe', keywords: ['künefe'], calories: 400, protein: 8, carbs: 45, fat: 20, basis: 'perUnit' },
  { name: 'Kebab', keywords: ['kebap', 'şiş kebap', 'kebab'], calories: 280, protein: 24, carbs: 5, fat: 18, basis: 'per100g' },
  { name: 'Wrap', keywords: ['dürüm', 'wrap'], calories: 450, protein: 20, carbs: 45, fat: 20, basis: 'perUnit' },
  // fast food & snacks
  { name: 'Pizza', keywords: ['pizza'], calories: 285, protein: 12, carbs: 36, fat: 10, basis: 'perUnit' },
  { name: 'Burger', keywords: ['burger', 'hamburger'], calories: 354, protein: 17, carbs: 29, fat: 17, basis: 'perUnit' },
  { name: 'French Fries', keywords: ['french fries', 'patates kızartması'], calories: 365, protein: 4, carbs: 48, fat: 17, basis: 'perUnit' },
  { name: 'Chips', keywords: ['chips', 'cips'], calories: 152, protein: 2, carbs: 15, fat: 10, basis: 'perUnit' },
  { name: 'Popcorn', keywords: ['popcorn', 'patlamış mısır'], calories: 31, protein: 1, carbs: 6, fat: 0.4, basis: 'perUnit' },
  { name: 'Ice Cream', keywords: ['ice cream', 'dondurma'], calories: 137, protein: 2, carbs: 16, fat: 7, basis: 'perUnit' },
  { name: 'Cookie', keywords: ['cookie', 'kurabiye'], calories: 150, protein: 2, carbs: 20, fat: 7, basis: 'perUnit' },
  { name: 'Dark Chocolate', keywords: ['dark chocolate', 'bitter çikolata', 'chocolate', 'çikolata'], calories: 170, protein: 2, carbs: 13, fat: 12, basis: 'perUnit' },
  { name: 'Protein Bar', keywords: ['protein bar'], calories: 200, protein: 20, carbs: 20, fat: 7, basis: 'perUnit' },
  { name: 'Granola Bar', keywords: ['granola bar'], calories: 120, protein: 2, carbs: 22, fat: 4, basis: 'perUnit' },
  // beverages
  { name: 'Soda', keywords: ['soda', 'kola', 'cola'], calories: 140, protein: 0, carbs: 39, fat: 0, basis: 'perUnit' },
  { name: 'Orange Juice', keywords: ['orange juice', 'portakal suyu'], calories: 110, protein: 2, carbs: 26, fat: 0.5, basis: 'perUnit' },
  { name: 'Beer', keywords: ['beer', 'bira'], calories: 153, protein: 1.6, carbs: 13, fat: 0, basis: 'perUnit' },
  { name: 'Wine', keywords: ['wine', 'şarap'], calories: 125, protein: 0.1, carbs: 4, fat: 0, basis: 'perUnit' },
  { name: 'Latte', keywords: ['latte', 'sütlü kahve'], calories: 120, protein: 6, carbs: 10, fat: 5, basis: 'perUnit' },
];

// ranked multi-result search for the autocomplete dropdown (progressive typing) —
// distinct from findFoodMatch below, which picks a single best match out of free text
function searchFoodDB(query, limit) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  FOOD_DB.forEach((entry) => {
    let bestRank = null;
    entry.keywords.forEach((kw) => {
      const idx = kw.indexOf(q);
      if (idx === -1) return;
      const rank = (idx === 0 ? 0 : 1000) + idx;
      if (bestRank === null || rank < bestRank) bestRank = rank;
    });
    if (bestRank !== null) scored.push({ entry, rank: bestRank });
  });
  scored.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit || 8).map((s) => s.entry);
}

function findFoodMatch(name) {
  const lower = name.toLowerCase();
  let best = null;
  let bestLen = 0;
  FOOD_DB.forEach((entry) => {
    entry.keywords.forEach((kw) => {
      if (lower.includes(kw) && kw.length > bestLen) {
        best = entry;
        bestLen = kw.length;
      }
    });
  });
  return best;
}

function extractQuantity(text) {
  const gramMatch = text.match(/(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)\b/i);
  if (gramMatch) return { grams: parseFloat(gramMatch[1]) };
  const countMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (countMatch) return { count: parseFloat(countMatch[1]) };
  return {};
}

function estimateNutrition(name) {
  const entry = findFoodMatch(name);
  if (!entry) return null;
  const qty = extractQuantity(name);
  const multiplier = entry.basis === 'per100g' ? (qty.grams ? qty.grams / 100 : 1) : qty.count || 1;
  return {
    calories: Math.round(entry.calories * multiplier),
    protein: Math.round(entry.protein * multiplier),
    carbs: Math.round(entry.carbs * multiplier),
    fat: Math.round(entry.fat * multiplier),
  };
}

// ---------- calorie-burn estimate constants ----------
const STRENGTH_MET = 5.0; // moderate-vigorous resistance training
const MIN_PER_SET = 3; // avg minutes per set incl. rest
const DEFAULT_BODYWEIGHT_KG = 88.5; // fallback from the user's profile, until they log a weight
const CARDIO_ACTIVITIES = {
  incline_walk: { label: 'Incline walk / treadmill', met: 4.3 },
  cycling: { label: 'Cycling (moderate)', met: 7.0 },
  running: { label: 'Running (jog)', met: 9.8 },
  hiit: { label: 'HIIT', met: 8.0 },
  other: { label: 'Other cardio', met: 6.0 },
};

// ---------- workout program (from the user's program doc) ----------
const PROGRAMS = {
  '4day': {
    label: '4-Day Upper/Lower',
    days: [
      { name: 'Upper A', exercises: [
        { name: 'Bench Press (Barbell)', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Barbell Row', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Overhead Press (Dumbbell)', sets: '3 × 8-10', rest: '90 sec' },
        { name: 'Lat Pulldown', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Incline Dumbbell Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Triceps Pushdown', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Bicep Curl', sets: '3 × 12-15', rest: '60 sec' },
      ] },
      { name: 'Lower A', exercises: [
        { name: 'Squat (Barbell)', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Romanian Deadlift', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Leg Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Leg Curl', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Walking Lunge', sets: '3 × 12/leg', rest: '60 sec' },
        { name: 'Calf Raise', sets: '4 × 15-20', rest: '45 sec' },
        { name: 'Plank', sets: '3 × 45-60 sec', rest: '45 sec' },
      ] },
      { name: 'Rest', exercises: [] },
      { name: 'Upper B', exercises: [
        { name: 'Deadlift', sets: '4 × 5-6', rest: '3 min' },
        { name: 'Pull-up / Assisted Pull-up', sets: '4 × 6-10', rest: '2 min' },
        { name: 'Dumbbell Shoulder Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Cable Row (Seated)', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Chest Fly (Machine/Cable)', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Lateral Raise', sets: '3 × 15', rest: '45 sec' },
        { name: 'Hammer Curl + Skull Crusher (superset)', sets: '3 × 12', rest: '60 sec' },
      ] },
      { name: 'Lower B', exercises: [
        { name: 'Front Squat / Goblet Squat', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Hip Thrust', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Bulgarian Split Squat', sets: '3 × 10/leg', rest: '90 sec' },
        { name: 'Leg Extension', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Seated Calf Raise', sets: '4 × 15-20', rest: '45 sec' },
        { name: 'Hanging Leg Raise', sets: '3 × 12-15', rest: '60 sec' },
      ] },
      { name: 'Rest', exercises: [] },
      { name: 'Rest', exercises: [] },
    ],
  },
  '6day': {
    label: '6-Day Push/Pull/Legs',
    days: [
      { name: 'Push 1', exercises: [
        { name: 'Bench Press', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Overhead Press', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Incline Dumbbell Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Lateral Raise', sets: '3 × 15', rest: '45 sec' },
        { name: 'Cable Fly', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Triceps Pushdown', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Overhead Triceps Extension', sets: '3 × 12-15', rest: '60 sec' },
      ] },
      { name: 'Pull 1', exercises: [
        { name: 'Deadlift', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Pull-up / Lat Pulldown', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Seated Cable Row', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Face Pull', sets: '3 × 15', rest: '60 sec' },
        { name: 'Barbell/EZ Curl', sets: '3 × 10-12', rest: '60 sec' },
        { name: 'Hammer Curl', sets: '3 × 12-15', rest: '60 sec' },
      ] },
      { name: 'Legs 1', exercises: [
        { name: 'Squat', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Romanian Deadlift', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Leg Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Leg Curl', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Bulgarian Split Squat', sets: '3 × 10/leg', rest: '90 sec' },
        { name: 'Calf Raise', sets: '4 × 15-20', rest: '45 sec' },
        { name: 'Cable Crunch / Hanging Leg Raise', sets: '3 × 15', rest: '60 sec' },
      ] },
      { name: 'Push 2', exercises: [
        { name: 'Bench Press', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Overhead Press', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Incline Dumbbell Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Lateral Raise', sets: '3 × 15', rest: '45 sec' },
        { name: 'Cable Fly', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Triceps Pushdown', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Overhead Triceps Extension', sets: '3 × 12-15', rest: '60 sec' },
      ] },
      { name: 'Pull 2', exercises: [
        { name: 'Barbell Row', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Pull-up / Lat Pulldown', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Seated Cable Row', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Face Pull', sets: '3 × 15', rest: '60 sec' },
        { name: 'Barbell/EZ Curl', sets: '3 × 10-12', rest: '60 sec' },
        { name: 'Hammer Curl', sets: '3 × 12-15', rest: '60 sec' },
      ] },
      { name: 'Legs 2', exercises: [
        { name: 'Front Squat', sets: '4 × 6-8', rest: '2-3 min' },
        { name: 'Romanian Deadlift', sets: '4 × 8-10', rest: '2 min' },
        { name: 'Leg Press', sets: '3 × 10-12', rest: '90 sec' },
        { name: 'Leg Curl', sets: '3 × 12-15', rest: '60 sec' },
        { name: 'Bulgarian Split Squat', sets: '3 × 10/leg', rest: '90 sec' },
        { name: 'Calf Raise', sets: '4 × 15-20', rest: '45 sec' },
        { name: 'Cable Crunch / Hanging Leg Raise', sets: '3 × 15', rest: '60 sec' },
      ] },
      { name: 'Rest', exercises: [] },
    ],
  },
};

// programs shown in the Program tab: the built-in splits above, plus a
// synthetic "My Workouts" split whose days are the user's Builder-created
// templates (data.workoutTemplates) — this lets Builder templates be picked
// and logged with the exact same split/day/set-editor UI as the built-ins.
function formatBuilderSetsLabel(item) {
  const reps = (item.repsTarget || '').toString().trim();
  return `${item.setsCount || 1} × ${reps || '-'}`;
}

function formatBuilderRestLabel(item) {
  const sec = Number(item.restSec) || 0;
  if (!sec) return '—';
  return sec % 60 === 0 ? `${sec / 60} min` : `${sec} sec`;
}

function getAllPrograms() {
  const programs = { ...PROGRAMS };
  if (data.workoutTemplates && data.workoutTemplates.length) {
    programs.custom = {
      label: 'My Workouts',
      custom: true,
      days: data.workoutTemplates.map((t) => ({
        name: t.name,
        exercises: t.exercises.map((item) => ({
          name: item.name,
          sets: formatBuilderSetsLabel(item),
          rest: formatBuilderRestLabel(item),
        })),
      })),
    };
  }
  return programs;
}

// ---------- date helpers ----------
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(str) {
  return parseLocalDate(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(str) {
  return parseLocalDate(str).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function lastNDays(n) {
  const arr = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    arr.push(toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
  }
  return arr;
}

function daysAgo(n) {
  const today = new Date();
  return toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
}

// ---------- tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'dashboard') renderDashboard();
    if (btn.dataset.tab === 'program') renderProgram();
    if (btn.dataset.tab === 'diet') renderGoalBars();
  });
});

// ---------- tooltip ----------
const tooltipEl = document.getElementById('tooltip');

function showTooltip(clientX, clientY, title, value) {
  tooltipEl.innerHTML = `<div class="tt-title">${title}</div><div class="tt-value">${value}</div>`;
  tooltipEl.hidden = false;
  const pad = 14;
  let x = clientX + pad;
  let y = clientY + pad;
  const rect = tooltipEl.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 8) x = clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight - 8) y = clientY - rect.height - pad;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

function hideTooltip() {
  tooltipEl.hidden = true;
}

// ---------- chart helpers ----------
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function pickLabelIndices(n) {
  if (n <= 1) return [0];
  if (n <= 6) return Array.from({ length: n }, (_, i) => i);
  return Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1])).sort((a, b) => a - b);
}

function renderLineChart(container, points, opts = {}) {
  const formatValue = opts.formatValue || ((v) => String(v));
  if (!points.length) {
    container.innerHTML = '<div class="chart-empty">No data yet</div>';
    return;
  }
  const w = 600, h = 220, padL = 40, padR = 16, padT = 16, padB = 28;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;

  const seriesColor = cssVar('--series-1');
  const gridColor = cssVar('--gridline');
  const baseColor = cssVar('--baseline');
  const mutedColor = cssVar('--text-muted');
  const surfaceColor = cssVar('--surface-1');

  const xStep = points.length > 1 ? (w - padL - padR) / (points.length - 1) : 0;
  const xAt = (i) => padL + xStep * i;
  const yAt = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);

  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const y = padT + ((h - padT - padB) * i) / 4;
    gridLines += `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.value)}`).join(' ');
  const circles = points
    .map((p, i) => `<circle data-i="${i}" cx="${xAt(i)}" cy="${yAt(p.value)}" r="4" fill="${seriesColor}" stroke="${surfaceColor}" stroke-width="2" />`)
    .join('');

  const labelIdxs = pickLabelIndices(points.length);
  const xLabels = labelIdxs
    .map((i) => {
      const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
      return `<text x="${xAt(i)}" y="${h - 8}" font-size="10" fill="${mutedColor}" text-anchor="${anchor}">${formatShortDate(points[i].dateStr)}</text>`;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Line chart">
    ${gridLines}
    <line x1="${padL}" x2="${w - padR}" y1="${h - padB}" y2="${h - padB}" stroke="${baseColor}" stroke-width="1"/>
    <path d="${pathD}" fill="none" stroke="${seriesColor}" stroke-width="2" />
    ${circles}
    ${xLabels}
  </svg>`;

  const svg = container.querySelector('svg');
  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const localX = ((e.clientX - rect.left) * w) / rect.width;
    let nearest = 0, nearestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xAt(i) - localX);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    const p = points[nearest];
    showTooltip(e.clientX, e.clientY, formatShortDate(p.dateStr), formatValue(p.value));
    svg.querySelectorAll('circle').forEach((c) => c.setAttribute('r', Number(c.dataset.i) === nearest ? 6 : 4));
  });
  svg.addEventListener('mouseleave', () => {
    hideTooltip();
    svg.querySelectorAll('circle').forEach((c) => c.setAttribute('r', 4));
  });
}

function renderBarChart(container, points, opts = {}) {
  const formatValue = opts.formatValue || ((v) => String(v));
  if (!points.length) {
    container.innerHTML = '<div class="chart-empty">No data yet</div>';
    return;
  }
  const w = 600, h = 220, padL = 40, padR = 16, padT = 16, padB = 28;
  const values = points.map((p) => p.value);
  let max = Math.max(...values, 1) * 1.15;

  const seriesColor = cssVar('--series-1');
  const gridColor = cssVar('--gridline');
  const baseColor = cssVar('--baseline');
  const mutedColor = cssVar('--text-muted');

  const n = points.length;
  const slot = (w - padL - padR) / n;
  const barWidth = Math.min(28, slot * 0.55);
  const xCenter = (i) => padL + slot * i + slot / 2;
  const yAt = (v) => padT + (1 - v / max) * (h - padT - padB);

  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const y = padT + ((h - padT - padB) * i) / 4;
    gridLines += `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
  }

  const bars = points
    .map((p, i) => {
      const x = xCenter(i) - barWidth / 2;
      const y = yAt(p.value);
      const barH = h - padB - y;
      return `<rect data-i="${i}" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barH, 0)}" rx="4" fill="${seriesColor}" />`;
    })
    .join('');

  const labelIdxs = pickLabelIndices(n);
  const xLabels = labelIdxs
    .map((i) => {
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text x="${xCenter(i)}" y="${h - 8}" font-size="10" fill="${mutedColor}" text-anchor="${anchor}">${formatShortDate(points[i].dateStr)}</text>`;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Bar chart">
    ${gridLines}
    <line x1="${padL}" x2="${w - padR}" y1="${h - padB}" y2="${h - padB}" stroke="${baseColor}" stroke-width="1"/>
    ${bars}
    ${xLabels}
  </svg>`;

  const svg = container.querySelector('svg');
  svg.querySelectorAll('rect').forEach((rect, i) => {
    rect.addEventListener('mousemove', (e) => {
      const p = points[i];
      showTooltip(e.clientX, e.clientY, formatShortDate(p.dateStr), formatValue(p.value));
      rect.setAttribute('opacity', '0.8');
    });
    rect.addEventListener('mouseleave', () => {
      hideTooltip();
      rect.setAttribute('opacity', '1');
    });
  });
}

// ---------- calorie-burn estimate ----------
function getBodyweightKg(dateStr) {
  const sorted = [...data.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const onOrBefore = sorted.filter((b) => b.date <= dateStr);
  if (onOrBefore.length) return onOrBefore[onOrBefore.length - 1].weight;
  if (sorted.length) return sorted[0].weight;
  return DEFAULT_BODYWEIGHT_KG;
}

function estimateCaloriesBurned(dateStr) {
  const weightKg = getBodyweightKg(dateStr);
  const setsCount = data.workouts.filter((w) => w.date === dateStr).length;
  const strengthHours = (setsCount * MIN_PER_SET) / 60;
  const strengthCal = STRENGTH_MET * weightKg * strengthHours;

  const cardioCal = data.cardio
    .filter((c) => c.date === dateStr)
    .reduce((sum, c) => {
      const met = CARDIO_ACTIVITIES[c.activity]?.met || CARDIO_ACTIVITIES.other.met;
      return sum + met * weightKg * (c.minutes / 60);
    }, 0);

  return Math.round(strengthCal + cardioCal);
}

function renderMultiLineChart(container, series, opts = {}) {
  const formatValue = opts.formatValue || ((v) => String(v));
  const allPoints = series.flatMap((s) => s.points);
  if (!allPoints.length) {
    container.innerHTML = '<div class="chart-empty">No data yet</div>';
    return;
  }
  const w = 600, h = 220, padL = 40, padR = 16, padT = 16, padB = 28;
  const values = allPoints.map((p) => p.value);
  let min = Math.min(0, ...values);
  let max = Math.max(...values);
  if (min === max) max += 1;
  const rangePad = (max - min) * 0.15;
  max += rangePad;

  const gridColor = cssVar('--gridline');
  const baseColor = cssVar('--baseline');
  const mutedColor = cssVar('--text-muted');
  const surfaceColor = cssVar('--surface-1');

  const n = series[0].points.length;
  const xStep = n > 1 ? (w - padL - padR) / (n - 1) : 0;
  const xAt = (i) => padL + xStep * i;
  const yAt = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);

  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const y = padT + ((h - padT - padB) * i) / 4;
    gridLines += `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
  }

  const seriesSvg = series
    .map((s) => {
      const pathD = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.value)}`).join(' ');
      const circles = s.points
        .map((p, i) => `<circle data-series="${s.name}" data-i="${i}" cx="${xAt(i)}" cy="${yAt(p.value)}" r="4" fill="${s.color}" stroke="${surfaceColor}" stroke-width="2" />`)
        .join('');
      return `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2" />${circles}`;
    })
    .join('');

  const labelIdxs = pickLabelIndices(n);
  const xLabels = labelIdxs
    .map((i) => {
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text x="${xAt(i)}" y="${h - 8}" font-size="10" fill="${mutedColor}" text-anchor="${anchor}">${formatShortDate(series[0].points[i].dateStr)}</text>`;
    })
    .join('');

  const legend = `<div class="chart-legend">${series
    .map((s) => `<span class="legend-item"><span class="legend-swatch" style="background:${s.color}"></span>${escapeHtml(s.name)}</span>`)
    .join('')}</div>`;

  container.innerHTML = `${legend}<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Line chart">
    ${gridLines}
    <line x1="${padL}" x2="${w - padR}" y1="${h - padB}" y2="${h - padB}" stroke="${baseColor}" stroke-width="1"/>
    ${seriesSvg}
    ${xLabels}
  </svg>`;

  const svg = container.querySelector('svg');
  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const localX = ((e.clientX - rect.left) * w) / rect.width;
    let nearest = 0, nearestDist = Infinity;
    series[0].points.forEach((p, i) => {
      const d = Math.abs(xAt(i) - localX);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    const title = formatShortDate(series[0].points[nearest].dateStr);
    const value = series.map((s) => `${s.name}: ${formatValue(s.points[nearest].value)}`).join(' &middot; ');
    showTooltip(e.clientX, e.clientY, title, value);
    svg.querySelectorAll('circle').forEach((c) => c.setAttribute('r', Number(c.dataset.i) === nearest ? 6 : 4));
  });
  svg.addEventListener('mouseleave', () => {
    hideTooltip();
    svg.querySelectorAll('circle').forEach((c) => c.setAttribute('r', 4));
  });
}

// ---------- dashboard ----------
function renderStatTiles() {
  const today = todayStr();
  const todaysCalories = data.meals.filter((m) => m.date === today).reduce((s, m) => s + m.calories, 0);

  const sortedBw = [...data.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const latestBw = sortedBw[sortedBw.length - 1];
  const prevBw = sortedBw[sortedBw.length - 2];

  const weekStart = daysAgo(6);
  const weekWorkouts = data.workouts.filter((w) => w.date >= weekStart);
  const weekVolume = weekWorkouts.reduce((s, w) => s + w.weight * w.reps, 0);

  const todaysBurned = estimateCaloriesBurned(today);

  const tiles = [
    { label: "Today's calories", value: `${todaysCalories}`, sub: `of ${GOALS.calories} kcal goal` },
    { label: 'Est. burned today', value: `${todaysBurned}`, sub: 'kcal, MET estimate' },
    {
      label: 'Latest weight',
      value: latestBw ? `${latestBw.weight}` : '—',
      sub: latestBw
        ? prevBw
          ? `${latestBw.weight - prevBw.weight >= 0 ? '+' : ''}${(latestBw.weight - prevBw.weight).toFixed(1)} vs prior log`
          : formatShortDate(latestBw.date)
        : 'no logs yet',
    },
    { label: 'Volume (7d)', value: `${Math.round(weekVolume).toLocaleString()}`, sub: 'weight × reps' },
    { label: 'Sets logged (7d)', value: `${weekWorkouts.length}`, sub: 'sets' },
  ];

  document.getElementById('stat-row').innerHTML = tiles
    .map(
      (t) => `<div class="stat-tile">
        <div class="label">${t.label}</div>
        <div class="value">${t.value}</div>
        <div class="delta flat">${t.sub}</div>
      </div>`
    )
    .join('');
}

function renderWeightChart() {
  const sorted = [...data.bodyweight].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const points = sorted.map((e) => ({ dateStr: e.date, value: e.weight }));
  renderLineChart(document.getElementById('chart-weight'), points, { formatValue: (v) => `${v}` });
}

function renderCaloriesChart() {
  const days = lastNDays(14);
  const points = days.map((ds) => ({
    dateStr: ds,
    value: data.meals.filter((m) => m.date === ds).reduce((s, m) => s + m.calories, 0),
  }));
  renderBarChart(document.getElementById('chart-calories'), points, { formatValue: (v) => `${v} kcal` });
}

function renderVolumeChart() {
  const days = lastNDays(14);
  const points = days.map((ds) => ({
    dateStr: ds,
    value: data.workouts.filter((w) => w.date === ds).reduce((s, w) => s + w.weight * w.reps, 0),
  }));
  renderLineChart(document.getElementById('chart-volume'), points, { formatValue: (v) => `${Math.round(v).toLocaleString()}` });
}

function renderBalanceChart() {
  const days = lastNDays(14);
  const consumed = days.map((ds) => ({
    dateStr: ds,
    value: data.meals.filter((m) => m.date === ds).reduce((s, m) => s + m.calories, 0),
  }));
  const burned = days.map((ds) => ({ dateStr: ds, value: estimateCaloriesBurned(ds) }));
  renderMultiLineChart(
    document.getElementById('chart-balance'),
    [
      { name: 'Consumed', color: cssVar('--series-1'), points: consumed },
      { name: 'Est. burned', color: cssVar('--series-2'), points: burned },
    ],
    { formatValue: (v) => `${v} kcal` }
  );
}

function renderDashboard() {
  renderStatTiles();
  renderWeightChart();
  renderCaloriesChart();
  renderBalanceChart();
  renderVolumeChart();
}

// ---------- program tab ----------
function renderSplitPicker() {
  const container = document.getElementById('split-picker');
  const programs = getAllPrograms();
  container.innerHTML = Object.entries(programs)
    .map(([key, prog]) => `<button class="pill${key === data.settings.splitKey ? ' active' : ''}" data-split="${key}">${prog.label}</button>`)
    .join('');
  container.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      data.settings.splitKey = pill.dataset.split;
      data.settings.dayIndex = 0;
      saveData();
      renderProgram();
    });
  });
  const hint = document.getElementById('split-hint');
  if (hint) hint.textContent = programs.custom ? '' : 'Build a custom workout in the Builder tab to see it here';
}

function renderDayPicker() {
  const prog = getAllPrograms()[data.settings.splitKey];
  const container = document.getElementById('day-picker');
  container.innerHTML = prog.days
    .map((day, i) => `<button class="pill${i === data.settings.dayIndex ? ' active' : ''}" data-day="${i}">${day.name}</button>`)
    .join('');
  container.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      data.settings.dayIndex = Number(pill.dataset.day);
      saveData();
      renderProgram();
    });
  });
}

function parseProgramSets(setsStr) {
  const numbers = setsStr.match(/\d+/g) || ['1', '0'];
  const setsCount = parseInt(numbers[0], 10);
  const reps = parseInt(numbers[numbers.length - 1], 10);
  return { setsCount, reps };
}

function getLastWeightForExercise(name) {
  const entries = data.workouts
    .filter((w) => w.exercise.toLowerCase() === name.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date));
  return entries.length ? entries[entries.length - 1].weight : '';
}

// exercises the user has expanded in the Program tab (UI-only, not persisted)
const expandedExercises = new Set();

function ensureTodayLog() {
  const today = todayStr();
  if (!data.todayLog || data.todayLog.date !== today) {
    data.todayLog = { date: today, entries: {} };
  }
}

function getExercisePlan(ex) {
  if (!data.exercisePlans[ex.name]) {
    const { setsCount, reps } = parseProgramSets(ex.sets);
    const fallbackWeight = data.exerciseWeights[ex.name] || getLastWeightForExercise(ex.name) || '';
    data.exercisePlans[ex.name] = Array.from({ length: setsCount }, () => ({ weight: fallbackWeight, reps }));
  }
  return data.exercisePlans[ex.name];
}

function getTodayEntryIds(name) {
  ensureTodayLog();
  if (!data.todayLog.entries[name]) data.todayLog.entries[name] = [];
  return data.todayLog.entries[name];
}

function renderSetEditor(ex, plan, entryIds) {
  const rows = plan
    .map((set, i) => {
      const done = Boolean(entryIds[i]);
      return `<div class="set-row" data-exercise="${escapeHtml(ex.name)}" data-index="${i}">
        <span class="set-num">Set ${i + 1}</span>
        <input type="number" class="set-weight" min="0" step="0.5" placeholder="wt" value="${set.weight}" />
        <span class="set-x">×</span>
        <input type="number" class="set-reps" min="0" step="1" placeholder="reps" value="${set.reps}" />
        <label class="set-done-label"><input type="checkbox" class="set-done" ${done ? 'checked' : ''} /> Done</label>
        <button type="button" class="set-remove" title="Remove set">&times;</button>
      </div>`;
    })
    .join('');
  return `<div class="set-editor">${rows}<button type="button" class="set-add" data-exercise="${escapeHtml(ex.name)}">+ Add set</button></div>`;
}

function renderProgramDayView() {
  const prog = getAllPrograms()[data.settings.splitKey];
  const day = prog.days[data.settings.dayIndex];
  const container = document.getElementById('program-day-view');

  if (!day.exercises.length) {
    container.innerHTML = prog.custom
      ? '<div class="rest-day-note">This workout has no exercises yet &mdash; add some in the Builder tab.</div>'
      : '<div class="rest-day-note">Rest day &mdash; or light cardio if you want it.</div>';
    return;
  }

  ensureTodayLog();

  container.innerHTML = `<table class="program-table">
    <thead><tr><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>Done</th></tr></thead>
    <tbody>
      ${day.exercises
        .map((ex) => {
          const plan = getExercisePlan(ex);
          const entryIds = getTodayEntryIds(ex.name);
          const doneCount = entryIds.filter(Boolean).length;
          const expanded = expandedExercises.has(ex.name);
          const expandRow = expanded
            ? `<tr class="ex-expand-row"><td colspan="4">${renderSetEditor(ex, plan, entryIds)}</td></tr>`
            : '';
          return `<tr class="ex-row" data-exercise="${escapeHtml(ex.name)}">
            <td class="ex-name"><span class="chevron">${expanded ? '▾' : '▸'}</span>${escapeHtml(ex.name)}</td>
            <td>${escapeHtml(ex.sets)}</td>
            <td>${escapeHtml(ex.rest)}</td>
            <td class="ex-progress">${doneCount}/${plan.length}</td>
          </tr>${expandRow}`;
        })
        .join('')}
    </tbody>
  </table>`;

  container.querySelectorAll('.ex-row').forEach((row) => {
    row.addEventListener('click', () => {
      const name = row.dataset.exercise;
      if (expandedExercises.has(name)) expandedExercises.delete(name);
      else expandedExercises.add(name);
      renderProgramDayView();
    });
  });

  container.querySelectorAll('.set-weight, .set-reps').forEach((input) => {
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      const row = input.closest('.set-row');
      const name = row.dataset.exercise;
      const idx = Number(row.dataset.index);
      const plan = data.exercisePlans[name];
      const entryIds = getTodayEntryIds(name);
      const weight = parseFloat(row.querySelector('.set-weight').value) || 0;
      const reps = parseInt(row.querySelector('.set-reps').value, 10) || 0;
      plan[idx] = { weight, reps };
      const entryId = entryIds[idx];
      if (entryId) {
        const entry = data.workouts.find((w) => w.id === entryId);
        if (entry) { entry.weight = weight; entry.reps = reps; }
      }
      saveData();
      if (entryId) renderWorkoutHistory();
    });
  });

  container.querySelectorAll('.set-done').forEach((checkbox) => {
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    checkbox.addEventListener('change', () => {
      const row = checkbox.closest('.set-row');
      const name = row.dataset.exercise;
      const idx = Number(row.dataset.index);
      const plan = data.exercisePlans[name];
      const entryIds = getTodayEntryIds(name);
      const weight = parseFloat(row.querySelector('.set-weight').value) || 0;
      const reps = parseInt(row.querySelector('.set-reps').value, 10) || 0;
      plan[idx] = { weight, reps };
      if (checkbox.checked) {
        const entry = { id: uid(), date: todayStr(), exercise: name, weight, reps };
        data.workouts.push(entry);
        entryIds[idx] = entry.id;
      } else {
        const entryId = entryIds[idx];
        if (entryId) data.workouts = data.workouts.filter((w) => w.id !== entryId);
        entryIds[idx] = undefined;
      }
      saveData();
      renderWorkoutHistory();
      updateExerciseDatalist();
      renderProgramDayView();
    });
  });

  container.querySelectorAll('.set-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.set-row');
      const name = row.dataset.exercise;
      const idx = Number(row.dataset.index);
      const plan = data.exercisePlans[name];
      const entryIds = getTodayEntryIds(name);
      if (plan.length <= 1) return;
      const removedEntryId = entryIds[idx];
      if (removedEntryId) data.workouts = data.workouts.filter((w) => w.id !== removedEntryId);
      plan.splice(idx, 1);
      entryIds.splice(idx, 1);
      saveData();
      renderWorkoutHistory();
      updateExerciseDatalist();
      renderProgramDayView();
    });
  });

  container.querySelectorAll('.set-add').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.exercise;
      const plan = data.exercisePlans[name];
      const last = plan[plan.length - 1] || { weight: '', reps: 0 };
      plan.push({ weight: last.weight, reps: last.reps });
      getTodayEntryIds(name);
      saveData();
      renderProgramDayView();
    });
  });
}

function renderProgram() {
  const programs = getAllPrograms();
  let changed = false;
  if (!programs[data.settings.splitKey]) {
    data.settings.splitKey = Object.keys(programs)[0];
    data.settings.dayIndex = 0;
    changed = true;
  } else {
    const dayCount = programs[data.settings.splitKey].days.length;
    if (data.settings.dayIndex >= dayCount) {
      data.settings.dayIndex = Math.max(0, dayCount - 1);
      changed = true;
    }
  }
  if (changed) saveData();
  renderSplitPicker();
  renderDayPicker();
  renderProgramDayView();
}

// ---------- workouts tab ----------
function updateExerciseDatalist() {
  const seen = new Set();
  const names = [];
  data.workouts.forEach((w) => {
    const key = w.exercise.toLowerCase();
    if (!seen.has(key)) { seen.add(key); names.push(w.exercise); }
  });
  document.getElementById('exercise-list').innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
}

function populateCardioSelect() {
  const select = document.querySelector('#form-cardio select[name="activity"]');
  select.innerHTML = Object.entries(CARDIO_ACTIVITIES)
    .map(([key, a]) => `<option value="${key}">${escapeHtml(a.label)}</option>`)
    .join('');
}

function renderWorkoutHistory() {
  const dateSet = new Set([
    ...data.workouts.map((w) => w.date),
    ...data.bodyweight.map((b) => b.date),
    ...data.cardio.map((c) => c.date),
  ]);
  const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  const container = document.getElementById('workout-history');

  if (!dates.length) {
    container.innerHTML = '<div class="chart-empty">Nothing logged yet</div>';
    return;
  }

  container.innerHTML = dates
    .map((date) => {
      const bw = data.bodyweight.find((b) => b.date === date);
      const sets = data.workouts.filter((w) => w.date === date);
      const cardioEntries = data.cardio.filter((c) => c.date === date);
      const bwRow = bw
        ? `<div class="history-row" data-kind="bodyweight" data-id="${bw.id}">
             <div class="hr-main"><span>Body weight</span><span class="hr-sub">${bw.weight}</span></div>
             <button class="hr-delete" data-kind="bodyweight" data-id="${bw.id}" title="Delete">&times;</button>
           </div>`
        : '';
      const setRows = sets
        .map(
          (s) => `<div class="history-row" data-kind="workout" data-id="${s.id}">
            <div class="hr-main"><span>${escapeHtml(s.exercise)}</span><span class="hr-sub">${s.weight} × ${s.reps}</span></div>
            <button class="hr-delete" data-kind="workout" data-id="${s.id}" title="Delete">&times;</button>
          </div>`
        )
        .join('');
      const cardioRows = cardioEntries
        .map(
          (c) => `<div class="history-row" data-kind="cardio" data-id="${c.id}">
            <div class="hr-main"><span>${escapeHtml(CARDIO_ACTIVITIES[c.activity]?.label || c.activity)}</span><span class="hr-sub">${c.minutes} min</span></div>
            <button class="hr-delete" data-kind="cardio" data-id="${c.id}" title="Delete">&times;</button>
          </div>`
        )
        .join('');
      const burned = estimateCaloriesBurned(date);
      return `<div class="history-group">
        <div class="history-group-title">${formatLongDate(date)} &middot; ~${burned} kcal est. burned</div>
        ${bwRow}${setRows}${cardioRows}
      </div>`;
    })
    .join('');
}

// ---------- diet tab ----------
function renderGoalBars() {
  const today = todayStr();
  const todaysMeals = data.meals.filter((m) => m.date === today);
  const totals = todaysMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const rows = [
    { key: 'calories', label: 'Calories', unit: 'kcal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'carbs', label: 'Carbs', unit: 'g' },
    { key: 'fat', label: 'Fat', unit: 'g' },
  ];

  document.getElementById('goal-bars').innerHTML = rows
    .map((r) => {
      const value = totals[r.key];
      const goal = GOALS[r.key];
      const pct = Math.min(100, Math.round((value / goal) * 100));
      return `<div class="goal-bar-row">
        <div class="goal-bar-label"><span>${r.label}</span><span>${value} / ${goal} ${r.unit}</span></div>
        <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join('');
}

function renderDietHistory() {
  const dates = Array.from(new Set(data.meals.map((m) => m.date))).sort((a, b) => b.localeCompare(a));
  const container = document.getElementById('diet-history');

  if (!dates.length) {
    container.innerHTML = '<div class="chart-empty">Nothing logged yet</div>';
    return;
  }

  container.innerHTML = dates
    .map((date) => {
      const meals = data.meals.filter((m) => m.date === date);
      const totalCal = meals.reduce((s, m) => s + m.calories, 0);
      const rows = meals
        .map(
          (m) => `<div class="history-row" data-kind="meal" data-id="${m.id}">
            <div class="hr-main">
              <span>${escapeHtml(m.name)}</span>
              <span class="hr-sub">${m.calories} kcal · P${m.protein} C${m.carbs} F${m.fat}</span>
            </div>
            <button class="hr-delete" data-kind="meal" data-id="${m.id}" title="Delete">&times;</button>
          </div>`
        )
        .join('');
      return `<div class="history-group">
        <div class="history-group-title">${formatLongDate(date)} · ${totalCal} kcal total</div>
        ${rows}
      </div>`;
    })
    .join('');
}

// ---------- delegated delete handlers ----------
document.getElementById('workout-history').addEventListener('click', (e) => {
  const btn = e.target.closest('.hr-delete');
  if (!btn) return;
  const { kind, id } = btn.dataset;
  if (kind === 'workout') data.workouts = data.workouts.filter((w) => w.id !== id);
  if (kind === 'bodyweight') data.bodyweight = data.bodyweight.filter((b) => b.id !== id);
  if (kind === 'cardio') data.cardio = data.cardio.filter((c) => c.id !== id);
  saveData();
  renderWorkoutHistory();
  updateExerciseDatalist();
});

document.getElementById('diet-history').addEventListener('click', (e) => {
  const btn = e.target.closest('.hr-delete');
  if (!btn) return;
  const { id } = btn.dataset;
  data.meals = data.meals.filter((m) => m.id !== id);
  saveData();
  renderDietHistory();
  renderGoalBars();
});

// ---------- forms ----------
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('form-workout').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  data.workouts.push({
    id: uid(),
    date: fd.get('date'),
    exercise: fd.get('exercise').trim(),
    weight: parseFloat(fd.get('weight')),
    reps: parseInt(fd.get('reps'), 10),
  });
  saveData();
  form.reset();
  setDefaultDates();
  renderWorkoutHistory();
  updateExerciseDatalist();
});

document.getElementById('form-bodyweight').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const date = fd.get('date');
  const weight = parseFloat(fd.get('weight'));
  const existing = data.bodyweight.find((b) => b.date === date);
  if (existing) existing.weight = weight;
  else data.bodyweight.push({ id: uid(), date, weight });
  saveData();
  form.reset();
  setDefaultDates();
  renderWorkoutHistory();
});

document.getElementById('form-cardio').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  data.cardio.push({
    id: uid(),
    date: fd.get('date'),
    activity: fd.get('activity'),
    minutes: parseInt(fd.get('minutes'), 10),
  });
  saveData();
  form.reset();
  setDefaultDates();
  renderWorkoutHistory();
});

document.getElementById('form-meal').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  data.meals.push({
    id: uid(),
    date: fd.get('date'),
    name: fd.get('name').trim(),
    calories: parseInt(fd.get('calories'), 10) || 0,
    protein: parseInt(fd.get('protein'), 10) || 0,
    carbs: parseInt(fd.get('carbs'), 10) || 0,
    fat: parseInt(fd.get('fat'), 10) || 0,
  });
  saveData();
  form.reset();
  setDefaultDates();
  Object.keys(mealTouched).forEach((k) => { mealTouched[k] = false; });
  mealEstimateHint.hidden = true;
  closeMealSearchDropdown();
  renderDietHistory();
  renderGoalBars();
});

// ---------- meal name search dropdown + calorie/macro auto-fill on selection ----------
const mealTouched = { calories: false, protein: false, carbs: false, fat: false };
const mealNameInput = document.querySelector('#form-meal input[name="name"]');
const mealFieldInputs = {
  calories: document.querySelector('#form-meal input[name="calories"]'),
  protein: document.querySelector('#form-meal input[name="protein"]'),
  carbs: document.querySelector('#form-meal input[name="carbs"]'),
  fat: document.querySelector('#form-meal input[name="fat"]'),
};
const mealEstimateHint = document.getElementById('meal-estimate-hint');
const mealSearchDropdown = document.getElementById('meal-search-dropdown');

Object.entries(mealFieldInputs).forEach(([key, input]) => {
  input.addEventListener('input', () => { mealTouched[key] = true; });
});

function applyFoodEstimate(entry) {
  const estimate = estimateNutrition(entry.name);
  if (!estimate) return;
  Object.entries(mealFieldInputs).forEach(([key, input]) => {
    input.value = estimate[key];
    mealTouched[key] = false;
  });
  mealEstimateHint.textContent = `≈ auto-filled from "${entry.name}" — edit any field if it's off`;
  mealEstimateHint.hidden = false;
}

function highlightFoodMatch(text, query) {
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, idx))}<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>${escapeHtml(text.slice(idx + query.length))}`;
}

let mealSearchResults = [];
let mealSearchActiveIndex = -1;
let mealSearchTimer = null;

function closeMealSearchDropdown() {
  mealSearchDropdown.hidden = true;
  mealSearchDropdown.innerHTML = '';
  mealSearchResults = [];
  mealSearchActiveIndex = -1;
  mealNameInput.setAttribute('aria-expanded', 'false');
  mealNameInput.removeAttribute('aria-activedescendant');
}

function setMealSearchActive(index) {
  mealSearchActiveIndex = index;
  mealSearchDropdown.querySelectorAll('.food-search-item').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
  if (index >= 0) {
    mealNameInput.setAttribute('aria-activedescendant', `meal-search-opt-${index}`);
    mealSearchDropdown.children[index].scrollIntoView({ block: 'nearest' });
  }
}

function selectMealSearchResult(index) {
  const entry = mealSearchResults[index];
  if (!entry) return;
  mealNameInput.value = entry.name;
  applyFoodEstimate(entry);
  closeMealSearchDropdown();
}

function renderMealSearchDropdown(query, results, loading) {
  mealSearchResults = results;
  mealSearchActiveIndex = -1;
  mealNameInput.setAttribute('aria-expanded', 'true');
  mealSearchDropdown.hidden = false;

  if (loading) {
    mealSearchDropdown.innerHTML = '<div class="food-search-status">Searching…</div>';
    return;
  }
  if (!results.length) {
    mealSearchDropdown.innerHTML = '<div class="food-search-status">No foods found</div>';
    return;
  }
  mealSearchDropdown.innerHTML = results
    .map((entry, i) => `<button type="button" class="food-search-item" id="meal-search-opt-${i}" role="option" data-index="${i}">
        <span class="food-search-name">${highlightFoodMatch(entry.name, query)}</span>
        <span class="food-search-meta">${entry.calories} kcal${entry.basis === 'per100g' ? ' /100g' : ''}</span>
      </button>`)
    .join('');
  mealSearchDropdown.querySelectorAll('.food-search-item').forEach((btn) => {
    btn.addEventListener('mouseenter', () => setMealSearchActive(Number(btn.dataset.index)));
    btn.addEventListener('click', () => selectMealSearchResult(Number(btn.dataset.index)));
  });
}

mealNameInput.addEventListener('input', () => {
  mealEstimateHint.hidden = true; // stale until a fresh selection is made
  const query = mealNameInput.value.trim();
  clearTimeout(mealSearchTimer);
  if (!query) { closeMealSearchDropdown(); return; }
  renderMealSearchDropdown(query, [], true);
  mealSearchTimer = setTimeout(() => {
    renderMealSearchDropdown(query, searchFoodDB(query, 8), false);
  }, 300);
});

mealNameInput.addEventListener('keydown', (e) => {
  if (mealSearchDropdown.hidden || !mealSearchResults.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setMealSearchActive((mealSearchActiveIndex + 1) % mealSearchResults.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setMealSearchActive((mealSearchActiveIndex - 1 + mealSearchResults.length) % mealSearchResults.length);
  } else if (e.key === 'Enter' && mealSearchActiveIndex >= 0) {
    e.preventDefault();
    selectMealSearchResult(mealSearchActiveIndex);
  } else if (e.key === 'Escape') {
    closeMealSearchDropdown();
  }
});

// let a dropdown item's click register before blur closes the dropdown
mealNameInput.addEventListener('blur', () => setTimeout(closeMealSearchDropdown, 150));
document.addEventListener('click', (e) => {
  if (!e.target.closest('.food-search-wrap')) closeMealSearchDropdown();
});

function setDefaultDates() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = todayStr();
  });
}

// ---------- theme change re-render ----------
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  renderWeightChart();
  renderCaloriesChart();
  renderBalanceChart();
  renderVolumeChart();
});

// ---------- init ----------
setDefaultDates();
updateExerciseDatalist();
populateCardioSelect();
renderWorkoutHistory();
renderDietHistory();
renderGoalBars();
renderProgram();
renderDashboard();

// ---------- public API surface for other scripts ----------
// exercise-library.js / exercise-picker.js / workout-builder.js load after this file and
// read/write through this object rather than relying on cross-<script> let/const visibility.
// `data` is a stable object reference (never reassigned, only mutated), so this stays live.
window.FTCore = {
  data,
  saveData,
  uid,
  escapeHtml,
  todayStr,
  toDateStr,
  parseLocalDate,
  formatShortDate,
  formatLongDate,
  daysAgo,
  lastNDays,
  cssVar,
  showTooltip,
  hideTooltip,
  GOALS,
  PROGRAMS,
  renderLineChart,
  updateExerciseDatalist,
  renderWorkoutHistory,
  getLastWeightForExercise,
};
