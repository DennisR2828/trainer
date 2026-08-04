/* Curated food / meal database + slot-scoped, target-aware suggestions.
 *
 * Mirrors exercise-db.js: a hand-picked list of easy, high-protein meals that
 * dietitians and trainers actually recommend, each tagged by meal slot with
 * per-serving macros. The Diet tab's "pick a meal" sheet ranks these to fit the
 * user's REMAINING calories/protein for the day (protein-dense + easy first).
 *
 * Macros are per one realistic serving and kept internally consistent
 * (4*protein + 4*carbs + 9*fat ~= kcal). Numbers are rounded, not lab-exact —
 * these are meal *ideas*, so "close" is the goal, not decimal precision.
 * Sourced from registered-dietitian / trainer high-protein meal guides and
 * cross-checked against USDA-consistent values. */

import { num } from './ui.js';

export const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: '☀️' },
  { key: 'lunch', label: 'Lunch', icon: '🥗' },
  { key: 'dinner', label: 'Dinner', icon: '🍽️' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
];
export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.key, s.label]));

/* Protein staples people build meals around (per common serving). Shown as a
 * quick reference at the bottom of the Diet tab. */
export const STAPLES = [
  { name: 'Chicken breast', per: '4 oz cooked', kcal: 187, protein: 35, carbs: 0, fat: 4 },
  { name: 'Whole eggs', per: '2 large', kcal: 143, protein: 13, carbs: 1, fat: 10 },
  { name: 'Egg whites', per: '1 cup', kcal: 126, protein: 26, carbs: 2, fat: 0 },
  { name: 'Greek yogurt, 0%', per: '1 cup', kcal: 130, protein: 23, carbs: 9, fat: 0 },
  { name: 'Cottage cheese, low-fat', per: '1 cup', kcal: 180, protein: 24, carbs: 8, fat: 5 },
  { name: 'Whey protein', per: '1 scoop', kcal: 120, protein: 25, carbs: 3, fat: 1 },
  { name: 'Canned tuna, in water', per: '1 can drained', kcal: 160, protein: 36, carbs: 0, fat: 1 },
  { name: 'Lean ground turkey, 93%', per: '4 oz cooked', kcal: 170, protein: 22, carbs: 0, fat: 9 },
];

/* MEALS: each { name, slots:[], kcal, protein, carbs, fat, prepMin, effort, how, tags:[] }.
 * Listed by slot for readability; the ranker re-sorts by fit to remaining macros. */
export const MEALS = [
  // ---------- breakfast ----------
  { name: 'Greek yogurt, berries & granola', slots: ['breakfast', 'snack'], kcal: 320, protein: 28, carbs: 40, fat: 5, prepMin: 3, effort: 'easy',
    how: 'Top 1 cup 0% Greek yogurt with 3/4 cup berries and 1/3 cup granola.', tags: ['high-protein', 'no-cook', 'quick', 'vegetarian'] },
  { name: 'Scrambled eggs & egg whites', slots: ['breakfast'], kcal: 250, protein: 30, carbs: 2, fat: 13, prepMin: 7, effort: 'easy',
    how: 'Scramble 2 whole eggs plus 4 egg whites in a nonstick pan; season.', tags: ['high-protein', 'low-carb', 'quick', 'vegetarian'] },
  { name: 'Protein overnight oats', slots: ['breakfast'], kcal: 400, protein: 33, carbs: 48, fat: 8, prepMin: 5, effort: 'easy',
    how: 'Mix 1/2 cup oats, 1 scoop whey, 1 cup milk and 1 tbsp chia; chill overnight.', tags: ['high-protein', 'high-fiber', 'meal-prep', 'vegetarian'] },
  { name: 'Cottage cheese & fruit bowl', slots: ['breakfast', 'snack'], kcal: 240, protein: 27, carbs: 20, fat: 5, prepMin: 3, effort: 'easy',
    how: 'Top 1 cup low-fat cottage cheese with 1/2 cup pineapple and hemp seeds.', tags: ['high-protein', 'no-cook', 'quick', 'vegetarian'] },
  { name: 'Peanut butter banana protein smoothie', slots: ['breakfast', 'snack'], kcal: 360, protein: 35, carbs: 34, fat: 10, prepMin: 4, effort: 'easy',
    how: 'Blend 1 scoop whey, 1 banana, 1 tbsp peanut butter, 1 cup milk and ice.', tags: ['high-protein', 'quick', 'vegetarian'] },
  { name: 'Veggie egg-white omelette', slots: ['breakfast'], kcal: 220, protein: 28, carbs: 8, fat: 8, prepMin: 10, effort: 'medium',
    how: 'Cook 1 cup egg whites plus 1 whole egg with spinach, peppers and 1 oz feta.', tags: ['high-protein', 'low-carb', 'vegetarian'] },
  { name: 'Avocado toast with eggs', slots: ['breakfast'], kcal: 380, protein: 22, carbs: 33, fat: 18, prepMin: 8, effort: 'easy',
    how: 'Mash 1/2 avocado on 1 slice whole-grain toast, top with 2 fried eggs.', tags: ['high-protein', 'high-fiber', 'vegetarian'] },
  { name: 'Turkey sausage & egg scramble', slots: ['breakfast'], kcal: 300, protein: 32, carbs: 4, fat: 17, prepMin: 10, effort: 'easy',
    how: 'Scramble 2 eggs with 3 oz lean turkey breakfast sausage.', tags: ['high-protein', 'low-carb'] },
  { name: 'Protein pancakes', slots: ['breakfast'], kcal: 340, protein: 30, carbs: 34, fat: 9, prepMin: 12, effort: 'medium',
    how: 'Blend 1 scoop whey, 1/2 cup oats, 1 egg and 1/2 banana; cook as pancakes.', tags: ['high-protein', 'vegetarian'] },
  { name: 'Smoked salmon & egg plate', slots: ['breakfast'], kcal: 300, protein: 30, carbs: 4, fat: 18, prepMin: 8, effort: 'easy',
    how: 'Serve 3 oz smoked salmon with 2 scrambled eggs and sliced tomato.', tags: ['high-protein', 'low-carb'] },
  { name: 'Egg & cheese breakfast burrito', slots: ['breakfast'], kcal: 420, protein: 32, carbs: 35, fat: 17, prepMin: 10, effort: 'easy',
    how: 'Fill a high-fiber tortilla with 2 eggs, 4 egg whites, 1 oz cheese and salsa.', tags: ['high-protein', 'high-fiber'] },
  { name: 'Savory cottage cheese & egg bowl', slots: ['breakfast'], kcal: 280, protein: 34, carbs: 8, fat: 12, prepMin: 8, effort: 'easy',
    how: 'Warm 1 cup cottage cheese, top with 2 soft-scrambled eggs and chili flakes.', tags: ['high-protein', 'low-carb', 'vegetarian'] },
  { name: 'Chocolate whey oatmeal', slots: ['breakfast'], kcal: 360, protein: 30, carbs: 45, fat: 7, prepMin: 6, effort: 'easy',
    how: 'Cook 1/2 cup oats in water, stir in 1 scoop chocolate whey off the heat.', tags: ['high-protein', 'high-fiber', 'quick', 'vegetarian'] },
  { name: 'Greek yogurt protein parfait', slots: ['breakfast', 'snack'], kcal: 300, protein: 32, carbs: 30, fat: 5, prepMin: 4, effort: 'easy',
    how: 'Layer 1 cup 0% Greek yogurt with 1/2 scoop whey, berries and 2 tbsp granola.', tags: ['high-protein', 'no-cook', 'quick', 'vegetarian'] },
  { name: 'Microwave egg-white & oat mug', slots: ['breakfast'], kcal: 290, protein: 28, carbs: 32, fat: 5, prepMin: 5, effort: 'easy',
    how: 'Microwave 1/2 cup oats, 1/2 cup egg whites, milk and cinnamon 2 min; stir.', tags: ['high-protein', 'quick', 'vegetarian', 'budget'] },

  // ---------- snacks ----------
  { name: 'Plain Greek yogurt cup', slots: ['snack'], kcal: 130, protein: 23, carbs: 9, fat: 0, prepMin: 1, effort: 'easy',
    how: 'Eat 1 cup 0% plain Greek yogurt; add cinnamon or a drizzle of honey.', tags: ['high-protein', 'no-cook', 'quick', 'vegetarian', 'low-carb'] },
  { name: 'Hard-boiled eggs (2)', slots: ['snack'], kcal: 155, protein: 13, carbs: 1, fat: 11, prepMin: 2, effort: 'easy',
    how: 'Peel and eat 2 pre-boiled eggs with a pinch of salt.', tags: ['high-protein', 'no-cook', 'low-carb', 'meal-prep', 'vegetarian', 'budget'] },
  { name: 'Tuna & crackers', slots: ['snack'], kcal: 240, protein: 30, carbs: 18, fat: 5, prepMin: 3, effort: 'easy',
    how: 'Mix 1 can tuna with a little mustard; eat with 6 whole-grain crackers.', tags: ['high-protein', 'no-cook', 'quick', 'budget'] },
  { name: 'String cheese & apple', slots: ['snack'], kcal: 180, protein: 14, carbs: 21, fat: 6, prepMin: 1, effort: 'easy',
    how: 'Pair 2 light string cheese sticks with 1 apple.', tags: ['high-protein', 'no-cook', 'quick', 'vegetarian'] },
  { name: 'Edamame', slots: ['snack'], kcal: 190, protein: 18, carbs: 15, fat: 8, prepMin: 4, effort: 'easy',
    how: 'Microwave 1 cup shelled edamame and sprinkle with sea salt.', tags: ['high-protein', 'high-fiber', 'vegan', 'quick'] },
  { name: 'Beef jerky', slots: ['snack'], kcal: 160, protein: 27, carbs: 10, fat: 2, prepMin: 1, effort: 'easy',
    how: 'Eat a 2 oz portion of lean beef jerky.', tags: ['high-protein', 'no-cook', 'quick', 'low-carb'] },
  { name: 'Roasted chickpeas', slots: ['snack'], kcal: 190, protein: 10, carbs: 27, fat: 5, prepMin: 2, effort: 'easy',
    how: 'Snack on 1/2 cup crunchy roasted chickpeas.', tags: ['high-fiber', 'vegan', 'no-cook', 'budget'] },
  { name: 'Ready-to-drink protein shake', slots: ['snack'], kcal: 160, protein: 30, carbs: 5, fat: 3, prepMin: 1, effort: 'easy',
    how: 'Shake and drink one bottled or blended whey protein shake.', tags: ['high-protein', 'no-cook', 'quick', 'low-carb'] },
  { name: 'Cottage cheese & cucumber', slots: ['snack'], kcal: 130, protein: 16, carbs: 6, fat: 5, prepMin: 3, effort: 'easy',
    how: 'Top 3/4 cup cottage cheese with sliced cucumber and black pepper.', tags: ['high-protein', 'no-cook', 'low-carb', 'quick', 'vegetarian'] },
  { name: 'Turkey & cheese roll-ups', slots: ['snack'], kcal: 170, protein: 22, carbs: 3, fat: 8, prepMin: 3, effort: 'easy',
    how: 'Roll 4 oz sliced deli turkey around 1 light cheese stick.', tags: ['high-protein', 'no-cook', 'low-carb', 'quick'] },
  { name: 'Protein yogurt bark', slots: ['snack'], kcal: 150, protein: 15, carbs: 16, fat: 3, prepMin: 5, effort: 'medium',
    how: 'Freeze 3/4 cup Greek yogurt mixed with 1/2 scoop whey and berries; break up.', tags: ['high-protein', 'meal-prep', 'vegetarian'] },
  { name: 'Almonds & Greek yogurt', slots: ['snack'], kcal: 240, protein: 20, carbs: 11, fat: 13, prepMin: 1, effort: 'easy',
    how: 'Eat 3/4 cup 0% Greek yogurt with a small handful (1 oz) of almonds.', tags: ['high-protein', 'no-cook', 'quick', 'vegetarian'] },

  // ---------- lunch / dinner ----------
  { name: 'Chicken, rice & broccoli bowl', slots: ['lunch', 'dinner'], kcal: 520, protein: 48, carbs: 55, fat: 9, prepMin: 20, effort: 'easy',
    how: 'Pan-cook 6 oz chicken; serve over 1 cup rice with steamed broccoli and soy sauce.', tags: ['high-protein', 'meal-prep', 'budget'] },
  { name: 'Teriyaki chicken & rice bowl', slots: ['lunch', 'dinner'], kcal: 560, protein: 46, carbs: 68, fat: 9, prepMin: 20, effort: 'easy',
    how: 'Pan-cook 6 oz chicken, toss in low-sugar teriyaki; serve over 1 cup rice with veg.', tags: ['high-protein', 'meal-prep', 'quick'] },
  { name: 'Chicken burrito bowl', slots: ['lunch', 'dinner'], kcal: 600, protein: 47, carbs: 62, fat: 15, prepMin: 20, effort: 'easy',
    how: 'Layer 6 oz grilled chicken, 3/4 cup rice, black beans, salsa, corn and a little cheese.', tags: ['high-protein', 'high-fiber', 'meal-prep'] },
  { name: 'Turkey taco bowl', slots: ['lunch', 'dinner'], kcal: 450, protein: 38, carbs: 40, fat: 15, prepMin: 20, effort: 'easy',
    how: 'Brown 6 oz lean turkey with taco seasoning; serve over rice or lettuce with salsa and beans.', tags: ['high-protein', 'meal-prep', 'one-pan'] },
  { name: 'Tuna & Greek yogurt pasta salad', slots: ['lunch'], kcal: 470, protein: 40, carbs: 52, fat: 11, prepMin: 12, effort: 'easy',
    how: 'Mix 2 cans tuna with nonfat Greek yogurt, light mayo, cooked pasta, corn and veg.', tags: ['high-protein', 'meal-prep', 'budget'] },
  { name: 'Chicken Caesar wrap', slots: ['lunch', 'dinner'], kcal: 440, protein: 42, carbs: 41, fat: 11, prepMin: 10, effort: 'easy',
    how: 'Fill a high-protein tortilla with 5 oz chicken, romaine, light Caesar and parmesan.', tags: ['high-protein', 'quick'] },
  { name: 'Tex-Mex cottage cheese bowl', slots: ['lunch'], kcal: 400, protein: 34, carbs: 30, fat: 16, prepMin: 8, effort: 'easy',
    how: 'Top 1.5 cups cottage cheese with black beans, corn, salsa, 1/4 avocado and peppers.', tags: ['high-protein', 'high-fiber', 'no-cook', 'vegetarian'] },
  { name: 'Turkey & cheese sandwich on wheat', slots: ['lunch'], kcal: 430, protein: 38, carbs: 45, fat: 11, prepMin: 6, effort: 'easy',
    how: 'Stack 5 oz deli turkey, low-fat cheese, lettuce and tomato on 2 slices wholegrain bread.', tags: ['high-protein', 'no-cook', 'quick', 'budget'] },
  { name: 'Egg-white fried rice with chicken', slots: ['lunch', 'dinner'], kcal: 480, protein: 45, carbs: 52, fat: 9, prepMin: 15, effort: 'easy',
    how: 'Stir-fry cold rice with 1 cup egg whites, 4 oz diced chicken, peas, carrots and soy.', tags: ['high-protein', 'one-pan', 'quick'] },
  { name: 'Chicken & sweet potato meal-prep box', slots: ['lunch', 'dinner'], kcal: 500, protein: 46, carbs: 50, fat: 11, prepMin: 30, effort: 'easy',
    how: 'Sheet-pan roast 6 oz chicken with cubed sweet potato and green beans.', tags: ['high-protein', 'meal-prep', 'one-pan'] },
  { name: 'Tuna salad lettuce cups', slots: ['lunch'], kcal: 350, protein: 42, carbs: 12, fat: 14, prepMin: 8, effort: 'easy',
    how: 'Mix 2 cans tuna with Greek yogurt, light mayo, celery and onion; spoon into lettuce.', tags: ['high-protein', 'low-carb', 'no-cook', 'budget'] },
  { name: 'Chicken & quinoa power bowl', slots: ['lunch', 'dinner'], kcal: 520, protein: 44, carbs: 48, fat: 14, prepMin: 20, effort: 'easy',
    how: 'Combine 5 oz grilled chicken, 3/4 cup quinoa, roasted veg and a spoon of hummus.', tags: ['high-protein', 'high-fiber', 'meal-prep'] },
  { name: 'Buffalo chicken & rice bowl', slots: ['lunch', 'dinner'], kcal: 510, protein: 48, carbs: 50, fat: 12, prepMin: 18, effort: 'easy',
    how: 'Toss 6 oz shredded chicken in buffalo sauce; serve over rice with celery and light ranch.', tags: ['high-protein', 'meal-prep', 'quick'] },
  { name: 'Greek chicken pita bowl', slots: ['lunch', 'dinner'], kcal: 530, protein: 45, carbs: 50, fat: 15, prepMin: 18, effort: 'easy',
    how: 'Serve 6 oz seasoned chicken with couscous or pita, cucumber, tomato and tzatziki.', tags: ['high-protein', 'meal-prep'] },
  { name: 'Shrimp & avocado rice bowl', slots: ['lunch', 'dinner'], kcal: 490, protein: 40, carbs: 52, fat: 12, prepMin: 15, effort: 'easy',
    how: 'Saute 7 oz shrimp with garlic; serve over rice with 1/4 avocado, edamame and lime.', tags: ['high-protein', 'quick', 'one-pan'] },
  { name: 'Salmon, rice & asparagus', slots: ['dinner', 'lunch'], kcal: 540, protein: 42, carbs: 45, fat: 20, prepMin: 20, effort: 'easy',
    how: 'Bake a 6 oz salmon fillet at 400F for 15 min; serve with 3/4 cup rice and asparagus.', tags: ['high-protein', 'one-pan'] },
  { name: 'Teriyaki salmon & broccoli bowl', slots: ['dinner', 'lunch'], kcal: 520, protein: 41, carbs: 48, fat: 18, prepMin: 20, effort: 'easy',
    how: 'Bake a 6 oz teriyaki-glazed salmon fillet; serve over rice with broccoli and edamame.', tags: ['high-protein', 'meal-prep'] },
  { name: 'Honey garlic shrimp stir-fry', slots: ['dinner', 'lunch'], kcal: 440, protein: 44, carbs: 48, fat: 7, prepMin: 18, effort: 'easy',
    how: 'Stir-fry 8 oz shrimp with mixed veg in a honey-garlic-soy sauce; serve over rice.', tags: ['high-protein', 'one-pan', 'quick'] },
  { name: 'Turkey chili', slots: ['dinner', 'lunch'], kcal: 420, protein: 40, carbs: 40, fat: 12, prepMin: 30, effort: 'easy',
    how: 'Simmer 6 oz lean ground turkey with kidney beans, tomatoes, onion and chili spices.', tags: ['high-protein', 'high-fiber', 'meal-prep', 'one-pan'] },
  { name: 'Lean beef & broccoli stir-fry', slots: ['dinner', 'lunch'], kcal: 520, protein: 44, carbs: 45, fat: 16, prepMin: 20, effort: 'easy',
    how: 'Stir-fry 5 oz sliced lean beef with broccoli in garlic-ginger-soy; serve over rice.', tags: ['high-protein', 'one-pan', 'quick'] },
  { name: 'Sirloin steak & sweet potato', slots: ['dinner'], kcal: 500, protein: 45, carbs: 38, fat: 18, prepMin: 25, effort: 'medium',
    how: 'Pan-sear a 6 oz sirloin; serve with a baked sweet potato and a side salad.', tags: ['high-protein'] },
  { name: 'Baked cod, potatoes & green beans', slots: ['dinner', 'lunch'], kcal: 430, protein: 42, carbs: 40, fat: 11, prepMin: 25, effort: 'easy',
    how: 'Bake 8 oz cod with lemon and herbs; serve with roasted baby potatoes and green beans.', tags: ['high-protein', 'one-pan'] },
  { name: 'Chicken fajita skillet', slots: ['dinner', 'lunch'], kcal: 480, protein: 46, carbs: 40, fat: 14, prepMin: 20, effort: 'easy',
    how: 'Saute 6 oz chicken strips with peppers and onions in fajita spice; serve with tortilla or rice.', tags: ['high-protein', 'one-pan', 'quick'] },
  { name: 'Baked chicken parmesan & zucchini', slots: ['dinner'], kcal: 510, protein: 50, carbs: 30, fat: 20, prepMin: 30, effort: 'medium',
    how: 'Bake a breaded 6 oz chicken breast with marinara and mozzarella; serve over sauteed zucchini.', tags: ['high-protein'] },
  { name: 'Ground turkey & sweet potato skillet', slots: ['dinner', 'lunch'], kcal: 470, protein: 42, carbs: 42, fat: 14, prepMin: 25, effort: 'easy',
    how: 'Brown 6 oz ground turkey with diced sweet potato, spinach and onion in one pan.', tags: ['high-protein', 'one-pan', 'meal-prep'] },
  { name: 'Tofu & vegetable stir-fry', slots: ['dinner', 'lunch'], kcal: 420, protein: 30, carbs: 38, fat: 16, prepMin: 20, effort: 'easy',
    how: 'Stir-fry a block of firm tofu with mixed veg in soy-ginger sauce; serve over rice.', tags: ['high-protein', 'vegetarian', 'vegan', 'one-pan'] },
  { name: 'Lentil & chickpea curry', slots: ['dinner', 'lunch'], kcal: 460, protein: 24, carbs: 62, fat: 13, prepMin: 25, effort: 'easy',
    how: 'Simmer red lentils and chickpeas in tomato-coconut curry sauce; serve over rice.', tags: ['vegetarian', 'vegan', 'high-fiber', 'meal-prep', 'budget'] },
  { name: 'Salmon & quinoa salad', slots: ['dinner', 'lunch'], kcal: 520, protein: 40, carbs: 40, fat: 20, prepMin: 20, effort: 'easy',
    how: 'Flake a 6 oz baked salmon over quinoa with cucumber, tomato, spinach and lemon dressing.', tags: ['high-protein', 'high-fiber', 'meal-prep'] },
  { name: 'Chicken sausage & pepper skillet', slots: ['dinner', 'lunch'], kcal: 460, protein: 38, carbs: 38, fat: 16, prepMin: 20, effort: 'easy',
    how: 'Saute sliced lean chicken sausage with peppers, onion and a little rice or potatoes.', tags: ['high-protein', 'one-pan', 'quick'] },
  { name: 'Turkey meatballs & marinara', slots: ['dinner', 'lunch'], kcal: 490, protein: 44, carbs: 44, fat: 15, prepMin: 30, effort: 'medium',
    how: 'Bake lean turkey meatballs, simmer in marinara; serve over pasta or zucchini noodles.', tags: ['high-protein', 'meal-prep'] },
];

/* Soft dietary filter — only excludes if the profile actually declares a diet.
 * (Onboarding does not capture this yet; this keeps the ranker future-proof.) */
/* Ingredient matching against the recipe text.
 *
 * The meals carry diet tags but no ingredient tags, so pescatarian and allergen
 * filtering has to read the text. That is a heuristic, not a guarantee — it errs
 * toward hiding a safe meal rather than showing an unsafe one, and nobody with a
 * real allergy should trust it over reading the recipe. Tagging all ~57 meals
 * properly would be the durable fix.
 */
const MEAT_RX = /chicken|beef|steak|pork|turkey|bacon|sausage|\bham\b|lamb|jerky|mince|ground meat/i;
const FISH_RX = /salmon|tuna|shrimp|prawn|\bcod\b|tilapia|\bfish\b|sardine|seafood|crab|scallop/i;

const AVOID_RX = {
  dairy:     /yogurt|milk|cheese|cottage|whey|butter(?!\s*bean)|cream|greek/i,
  gluten:    /bread|pasta|tortilla|wrap|bagel|cereal|granola|couscous|barley|cracker|\bbun\b|flour|oats?\b/i,
  nuts:      /almond|peanut|walnut|cashew|pecan|pistachio|nut butter|\bnuts?\b/i,
  shellfish: /shrimp|prawn|crab|lobster|scallop/i,
  eggs:      /\beggs?\b|egg white/i,
  soy:       /tofu|edamame|\bsoy\b|tempeh|miso|soya/i,
};

const foodText = (m) => `${m.name} ${m.how || ''}`;

export function isAllowedFood(m, profile = {}) {
  const text = foodText(m);

  const diet = profile && profile.diet;
  if (diet === 'vegan' && !m.tags.includes('vegan')) return false;
  if (diet === 'vegetarian' && !(m.tags.includes('vegetarian') || m.tags.includes('vegan'))) return false;
  if (diet === 'pescatarian') {
    const veg = m.tags.includes('vegetarian') || m.tags.includes('vegan');
    if (!veg && !FISH_RX.test(text)) return false;   // not vegetarian and no fish => meat
    if (MEAT_RX.test(text)) return false;
  }

  for (const a of profile.avoids || []) {
    const rx = AVOID_RX[a];
    if (rx && rx.test(text)) return false;
  }
  return true;
}

export function mealsForSlot(slot) {
  return MEALS.filter((m) => m.slots.includes(slot));
}

/* Score a meal for how well it fits the day's remaining calories/protein.
 * Rewards protein that fills the remaining protein gap and protein-per-calorie
 * density; penalizes blowing past the remaining calorie budget; nudges easy /
 * quick meals up. Used to order the pick-a-meal sheet. */
function scoreMeal(m, calLeft, proLeft) {
  const density = m.protein / Math.max(1, m.kcal);   // protein per kcal
  let score = density * 800;
  if (proLeft > 0) score += Math.min(m.protein, proLeft) * 2.2;   // covers the protein gap
  if (calLeft > 0 && m.kcal > calLeft) score -= (m.kcal - calLeft) * 0.5; // overshoots budget
  if (m.effort === 'easy') score += 18;
  score -= num(m.prepMin) * 0.4;
  return score;
}

/* Ranked meal ideas for a slot, best-fit first. `remaining` = { calories, protein }. */
export function rankedMeals(slot, remaining = {}, profile = {}) {
  const calLeft = Math.max(0, num(remaining.calories));
  const proLeft = Math.max(0, num(remaining.protein));
  return mealsForSlot(slot)
    .filter((m) => isAllowedFood(m, profile))
    .map((m) => ({ m, s: scoreMeal(m, calLeft, proLeft) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}
