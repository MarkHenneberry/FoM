# Recipe Cost and Nutrition Planner

A self-contained browser app for storing recipes, ingredient amounts, price estimates, calories, and macros.

## Open

Open `dashboard.html` for the recipe dashboard, or `index.html` for the recipe builder.

## Use

1. Enter a recipe name and serving count.
2. Add ingredients with their amount in grams.
3. Optionally enter price per 100g.
4. Enter calories, protein, carbs, and fat per 100g.
5. Save the recipe.

Saved recipes appear in the dashboard and are stored in the browser with `localStorage`.

Use the `Save` button on an ingredient row to store that ingredient's per-100g price and nutrition values. Use `Saved ingredient` and `Add Saved` to reuse it in another recipe.

Typing the exact name of a saved ingredient in a new ingredient row will auto-fill its saved per-100g price and nutrition values.

The scaling section can recalculate ingredient amounts by target servings or by target grams per serving.

The dashboard includes a recipe combiner that lets saved recipes act as sub-recipes in a larger recipe. Add sub-recipes, set batch amounts, and review combined totals plus each sub-recipe breakdown.
