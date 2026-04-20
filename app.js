const STORAGE_KEY = "recipe-cost-nutrition-planner";
const INGREDIENT_STORAGE_KEY = "recipe-cost-nutrition-ingredients";

const state = {
  recipes: [],
  savedIngredients: [],
  selectedId: null,
  lastScaleInput: "servings",
  scaleFactor: 1,
};

const elements = {
  form: document.querySelector("#recipeForm"),
  recipeName: document.querySelector("#recipeName"),
  recipeServings: document.querySelector("#recipeServings"),
  ingredientRows: document.querySelector("#ingredientRows"),
  ingredientRowTemplate: document.querySelector("#ingredientRowTemplate"),
  addIngredientButton: document.querySelector("#addIngredientButton"),
  savedIngredientSelect: document.querySelector("#savedIngredientSelect"),
  savedIngredientNames: document.querySelector("#savedIngredientNames"),
  addSavedIngredientButton: document.querySelector("#addSavedIngredientButton"),
  newRecipeButton: document.querySelector("#newRecipeButton"),
  deleteRecipeButton: document.querySelector("#deleteRecipeButton"),
  recipeDashboard: document.querySelector("#recipeDashboard"),
  recipeCount: document.querySelector("#recipeCount"),
  recipeTotalsGrid: document.querySelector("#recipeTotalsGrid"),
  servingTotalsGrid: document.querySelector("#servingTotalsGrid"),
  targetServings: document.querySelector("#targetServings"),
  targetServingGrams: document.querySelector("#targetServingGrams"),
  resetScaleButton: document.querySelector("#resetScaleButton"),
  scaleHelp: document.querySelector("#scaleHelp"),
  scaledRows: document.querySelector("#scaledRows"),
  landingRecipeGrid: document.querySelector("#landingRecipeGrid"),
  landingRecipeCount: document.querySelector("#landingRecipeCount"),
};

function createId() {
  return `recipe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function numberFromInput(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatInputNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number(value.toFixed(2)).toString();
}

function formatWholeInputNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Math.max(Math.round(value), 1).toString();
}

function formatGrams(value) {
  return `${formatNumber(value)} g`;
}

function normalizeIngredient(ingredient = {}) {
  return {
    name: ingredient.name || "",
    amount: Number(ingredient.amount) || 0,
    price: ingredient.price === "" || ingredient.price === null ? null : Number(ingredient.price) || 0,
    calories: Number(ingredient.calories) || 0,
    protein: Number(ingredient.protein) || 0,
    carbs: Number(ingredient.carbs) || 0,
    fat: Number(ingredient.fat) || 0,
  };
}

function emptyIngredient() {
  return normalizeIngredient();
}

function normalizeSavedIngredient(ingredient = {}) {
  return {
    id: ingredient.id || createId(),
    name: ingredient.name || "",
    price: ingredient.price === "" || ingredient.price === null ? null : Number(ingredient.price) || 0,
    calories: Number(ingredient.calories) || 0,
    protein: Number(ingredient.protein) || 0,
    carbs: Number(ingredient.carbs) || 0,
    fat: Number(ingredient.fat) || 0,
    updatedAt: ingredient.updatedAt || new Date().toISOString(),
  };
}

function savedIngredientToRecipeIngredient(ingredient) {
  return normalizeIngredient({
    name: ingredient.name,
    amount: 0,
    price: ingredient.price,
    calories: ingredient.calories,
    protein: ingredient.protein,
    carbs: ingredient.carbs,
    fat: ingredient.fat,
  });
}

function normalizeAdjustment(recipe) {
  const adjustment = recipe.adjustment || {};
  const originalTotals = totalsForRecipe({
    servings: Number(recipe.servings) || 1,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(normalizeIngredient) : [],
  });
  const targetServings = Math.max(Math.round(Number(adjustment.targetServings) || Number(recipe.servings) || 1), 1);
  const targetServingGrams =
    Number(adjustment.targetServingGrams) ||
    (originalTotals.serving.weight ? Number(formatInputNumber(originalTotals.serving.weight)) : 0);
  const lastScaleInput = adjustment.lastScaleInput === "servingGrams" ? "servingGrams" : "servings";
  const scaleFactor =
    originalTotals.recipe.weight > 0 && targetServingGrams > 0
      ? (targetServings * targetServingGrams) / originalTotals.recipe.weight
      : targetServings / Math.max(Number(recipe.servings) || 1, 0.01);

  return {
    targetServings,
    targetServingGrams,
    lastScaleInput,
    scaleFactor,
  };
}

function normalizeRecipe(recipe = {}) {
  const normalized = {
    ...recipe,
    id: recipe.id || createId(),
    name: recipe.name || "Untitled recipe",
    servings: Number(recipe.servings) || 1,
    updatedAt: recipe.updatedAt || new Date().toISOString(),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(normalizeIngredient) : [],
  };

  normalized.adjustment = normalizeAdjustment(normalized);
  return normalized;
}

function loadRecipes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.recipes = Array.isArray(parsed) ? parsed.map(normalizeRecipe) : [];
  } catch {
    state.recipes = [];
  }
}

function loadSavedIngredients() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INGREDIENT_STORAGE_KEY) || "[]");
    state.savedIngredients = Array.isArray(parsed) ? parsed.map(normalizeSavedIngredient).filter((ingredient) => ingredient.name) : [];
  } catch {
    state.savedIngredients = [];
  }
}

function saveRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recipes));
}

function saveSavedIngredients() {
  localStorage.setItem(INGREDIENT_STORAGE_KEY, JSON.stringify(state.savedIngredients));
}

function totalsForRecipe(recipe) {
  const servings = Math.max(Number(recipe.servings) || 1, 0.01);
  const totals = recipe.ingredients.reduce(
    (sum, ingredient) => {
      const amountRatio = ingredient.amount / 100;
      const price = ingredient.price === null ? 0 : ingredient.price * amountRatio;

      sum.weight += ingredient.amount;
      sum.price += price;
      sum.calories += ingredient.calories * amountRatio;
      sum.protein += ingredient.protein * amountRatio;
      sum.carbs += ingredient.carbs * amountRatio;
      sum.fat += ingredient.fat * amountRatio;
      return sum;
    },
    {
      weight: 0,
      price: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  );

  return {
    recipe: totals,
    serving: {
      weight: totals.weight / servings,
      price: totals.price / servings,
      calories: totals.calories / servings,
      protein: totals.protein / servings,
      carbs: totals.carbs / servings,
      fat: totals.fat / servings,
    },
  };
}

function savedAdjustmentForRecipe(recipe) {
  const totals = totalsForRecipe(recipe);
  const adjustment = recipe.adjustment || {};
  const targetServings = Math.max(Math.round(Number(adjustment.targetServings) || Number(recipe.servings) || 1), 1);
  const targetServingGrams =
    Number(adjustment.targetServingGrams) ||
    (totals.serving.weight ? Number(formatInputNumber(totals.serving.weight)) : 0);
  const scaleFactor =
    totals.recipe.weight > 0 && targetServingGrams > 0
      ? (targetServings * targetServingGrams) / totals.recipe.weight
      : targetServings / Math.max(Number(recipe.servings) || 1, 0.01);

  return {
    targetServings,
    targetServingGrams,
    scaleFactor,
  };
}

function activeAdjustmentForRecipe(recipe) {
  if (elements.targetServings && elements.targetServingGrams) {
    return {
      targetServings: targetServingsForRecipe(recipe),
      targetServingGrams: numberFromInput(elements.targetServingGrams),
      scaleFactor: scaleFactorForRecipe(recipe),
    };
  }

  return savedAdjustmentForRecipe(recipe);
}

function readRecipeFromForm() {
  const id = state.selectedId || createId();
  const ingredients = [...elements.ingredientRows.querySelectorAll("tr")].map(ingredientFromRow);
  const servings = Math.max(numberFromInput(elements.recipeServings), 0.01);
  const draftTotals = totalsForRecipe({ servings, ingredients });
  const targetServingGrams = numberFromInput(elements.targetServingGrams) || draftTotals.serving.weight;

  return {
    id,
    name: elements.recipeName.value.trim() || "Untitled recipe",
    servings,
    updatedAt: new Date().toISOString(),
    ingredients,
    adjustment: {
      targetServings: targetServingsForRecipe({ servings, ingredients }),
      targetServingGrams,
      lastScaleInput: state.lastScaleInput,
      scaleFactor: scaleFactorForRecipe({ servings, ingredients }),
    },
  };
}

function currentRecipe() {
  return readRecipeFromForm();
}

function ingredientFromRow(row) {
  const priceValue = row.querySelector(".ingredient-price").value.trim();

  return normalizeIngredient({
    name: row.querySelector(".ingredient-name").value.trim(),
    amount: numberFromInput(row.querySelector(".ingredient-amount")),
    price: priceValue === "" ? null : Number.parseFloat(priceValue),
    calories: numberFromInput(row.querySelector(".ingredient-calories")),
    protein: numberFromInput(row.querySelector(".ingredient-protein")),
    carbs: numberFromInput(row.querySelector(".ingredient-carbs")),
    fat: numberFromInput(row.querySelector(".ingredient-fat")),
  });
}

function saveIngredientFromRow(row) {
  const ingredient = ingredientFromRow(row);

  if (!ingredient.name) {
    row.querySelector(".ingredient-name").focus();
    return;
  }

  const savedIngredient = normalizeSavedIngredient({
    name: ingredient.name,
    price: ingredient.price,
    calories: ingredient.calories,
    protein: ingredient.protein,
    carbs: ingredient.carbs,
    fat: ingredient.fat,
    updatedAt: new Date().toISOString(),
  });
  const existingIndex = state.savedIngredients.findIndex(
    (item) => item.name.toLowerCase() === savedIngredient.name.toLowerCase(),
  );

  if (existingIndex >= 0) {
    savedIngredient.id = state.savedIngredients[existingIndex].id;
    state.savedIngredients[existingIndex] = savedIngredient;
  } else {
    state.savedIngredients.push(savedIngredient);
  }

  state.savedIngredients.sort((a, b) => a.name.localeCompare(b.name));
  saveSavedIngredients();
  renderSavedIngredientOptions(savedIngredient.id);
}

function renderSavedIngredientOptions(selectedId = "") {
  if (!elements.savedIngredientSelect) {
    return;
  }

  elements.savedIngredientSelect.innerHTML = "";
  if (elements.savedIngredientNames) {
    elements.savedIngredientNames.innerHTML = "";
  }

  if (!state.savedIngredients.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved ingredients";
    elements.savedIngredientSelect.append(option);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose ingredient";
  elements.savedIngredientSelect.append(placeholder);

  state.savedIngredients.forEach((ingredient) => {
    const option = document.createElement("option");
    option.value = ingredient.id;
    option.textContent = ingredient.name;
    elements.savedIngredientSelect.append(option);

    if (elements.savedIngredientNames) {
      const nameOption = document.createElement("option");
      nameOption.value = ingredient.name;
      elements.savedIngredientNames.append(nameOption);
    }
  });

  elements.savedIngredientSelect.value = selectedId;
}

function addSelectedSavedIngredient() {
  const ingredient = state.savedIngredients.find((item) => item.id === elements.savedIngredientSelect.value);

  if (!ingredient) {
    elements.savedIngredientSelect.focus();
    return;
  }

  addIngredientRow(savedIngredientToRecipeIngredient(ingredient));
  renderOutputs();
}

function findSavedIngredientByName(name) {
  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return state.savedIngredients.find((ingredient) => ingredient.name.toLowerCase() === normalizedName) || null;
}

function applySavedNutritionToRow(row, ingredient) {
  row.querySelector(".ingredient-price").value = ingredient.price === null ? "" : ingredient.price || "";
  row.querySelector(".ingredient-calories").value = ingredient.calories || "";
  row.querySelector(".ingredient-protein").value = ingredient.protein || "";
  row.querySelector(".ingredient-carbs").value = ingredient.carbs || "";
  row.querySelector(".ingredient-fat").value = ingredient.fat || "";
}

function gatherNutritionForIngredientName(row) {
  const nameInput = row.querySelector(".ingredient-name");
  const savedIngredient = findSavedIngredientByName(nameInput.value);

  if (!savedIngredient) {
    return;
  }

  nameInput.value = savedIngredient.name;
  applySavedNutritionToRow(row, savedIngredient);
  renderOutputs();
}

function addIngredientRow(ingredient = emptyIngredient()) {
  const fragment = elements.ingredientRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector("tr");

  row.querySelector(".ingredient-name").value = ingredient.name || "";
  row.querySelector(".ingredient-amount").value = ingredient.amount || "";
  row.querySelector(".ingredient-price").value = ingredient.price === null ? "" : ingredient.price || "";
  row.querySelector(".ingredient-calories").value = ingredient.calories || "";
  row.querySelector(".ingredient-protein").value = ingredient.protein || "";
  row.querySelector(".ingredient-carbs").value = ingredient.carbs || "";
  row.querySelector(".ingredient-fat").value = ingredient.fat || "";

  row.querySelector(".ingredient-name").addEventListener("change", () => {
    gatherNutritionForIngredientName(row);
  });

  row.querySelector(".ingredient-name").addEventListener("blur", () => {
    gatherNutritionForIngredientName(row);
  });

  row.querySelector(".save-ingredient").addEventListener("click", () => {
    saveIngredientFromRow(row);
  });

  row.querySelector(".remove-ingredient").addEventListener("click", () => {
    row.remove();
    if (!elements.ingredientRows.children.length) {
      addIngredientRow();
    }
    renderOutputs();
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", renderOutputs);
  });

  elements.ingredientRows.append(row);
}

function setFormRecipe(recipe) {
  state.selectedId = recipe.id;
  elements.recipeName.value = recipe.name;
  elements.recipeServings.value = recipe.servings;
  elements.ingredientRows.innerHTML = "";

  const ingredients = recipe.ingredients.length ? recipe.ingredients : [emptyIngredient()];
  ingredients.forEach(addIngredientRow);

  applySavedScaleControls(recipe);
  renderAll();
}

function newRecipe() {
  const recipe = {
    id: createId(),
    name: "",
    servings: 4,
    ingredients: [emptyIngredient()],
    adjustment: null,
    updatedAt: new Date().toISOString(),
  };

  setFormRecipe(recipe);
}

function upsertCurrentRecipe() {
  const recipe = currentRecipe();
  const existingIndex = state.recipes.findIndex((item) => item.id === recipe.id);

  if (existingIndex >= 0) {
    state.recipes[existingIndex] = recipe;
  } else {
    state.recipes.unshift(recipe);
  }

  state.selectedId = recipe.id;
  saveRecipes();
  renderAll();
}

function deleteCurrentRecipe() {
  if (!state.selectedId) {
    newRecipe();
    return;
  }

  const savedRecipe = state.recipes.find((recipe) => recipe.id === state.selectedId);
  if (savedRecipe && !window.confirm(`Delete "${savedRecipe.name || "Untitled recipe"}"?`)) {
    return;
  }

  state.recipes = state.recipes.filter((recipe) => recipe.id !== state.selectedId);
  saveRecipes();

  if (state.recipes.length) {
    setFormRecipe(state.recipes[0]);
  } else {
    newRecipe();
    renderAll();
  }
}

function renderDashboard() {
  elements.recipeDashboard.innerHTML = "";
  elements.recipeCount.textContent = `${state.recipes.length} ${state.recipes.length === 1 ? "recipe" : "recipes"}`;

  if (!state.recipes.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Saved recipes will appear here.";
    elements.recipeDashboard.append(empty);
    return;
  }

  state.recipes.forEach((recipe) => {
    const adjustment = savedAdjustmentForRecipe(recipe);
    const totals = adjustedTotalsForRecipe(recipe, adjustment);
    const button = document.createElement("button");
    button.className = `recipe-card${recipe.id === state.selectedId ? " active" : ""}`;
    button.type = "button";
    button.addEventListener("click", () => setFormRecipe(recipe));

    const name = document.createElement("strong");
    name.textContent = recipe.name || "Untitled recipe";

    const stats = document.createElement("div");
    stats.className = "recipe-stats";
    stats.textContent = `${formatNumber(adjustment.targetServings, 0)} servings | ${formatCurrency(totals.recipe.price)} | ${formatNumber(totals.serving.calories, 0)} cal/serving`;

    if (recipe.id === state.selectedId) {
      const selected = document.createElement("span");
      selected.className = "selected-pill";
      selected.textContent = "Selected";
      button.append(name, selected, stats);
    } else {
      button.append(name, stats);
    }

    elements.recipeDashboard.append(button);
  });
}

function createSummaryItem(label, value) {
  const item = document.createElement("div");
  item.className = "summary-item";
  const span = document.createElement("span");
  span.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  item.append(span, strong);
  return item;
}

function createDetailItem(label, value) {
  const item = document.createElement("div");
  item.className = "detail-item";
  const span = document.createElement("span");
  span.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  item.append(span, strong);
  return item;
}

function renderLandingDashboard() {
  elements.landingRecipeGrid.innerHTML = "";
  elements.landingRecipeCount.textContent = `${state.recipes.length} ${state.recipes.length === 1 ? "recipe" : "recipes"}`;

  if (!state.recipes.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Saved recipes will appear here.";
    elements.landingRecipeGrid.append(empty);
    return;
  }

  state.recipes.forEach((recipe) => {
    const adjustment = savedAdjustmentForRecipe(recipe);
    const totals = adjustedTotalsForRecipe(recipe, adjustment);
    const card = document.createElement("details");
    card.className = "landing-recipe-card";

    const summary = document.createElement("summary");
    const title = document.createElement("div");
    title.className = "landing-card-title";
    const name = document.createElement("strong");
    name.textContent = recipe.name || "Untitled recipe";
    const servingCount = document.createElement("span");
    servingCount.textContent = `${formatNumber(adjustment.targetServings, 0)} servings`;
    title.append(name, servingCount);

    const quickStats = document.createElement("div");
    quickStats.className = "landing-summary-grid";
    quickStats.append(
      createSummaryItem("Recipe price", formatCurrency(totals.recipe.price)),
      createSummaryItem("Per serving", formatCurrency(totals.serving.price)),
      createSummaryItem("Calories", formatNumber(totals.serving.calories, 0)),
      createSummaryItem("Protein", `${formatNumber(totals.serving.protein)} g`),
    );
    summary.append(title, quickStats);

    const detail = document.createElement("div");
    detail.className = "landing-card-detail";
    const detailGrid = document.createElement("div");
    detailGrid.className = "landing-detail-grid";
    detailGrid.append(
      createDetailItem("Recipe weight", formatGrams(totals.recipe.weight)),
      createDetailItem("Serving weight", formatGrams(totals.serving.weight)),
      createDetailItem("Ingredients", formatNumber(recipe.ingredients.length, 0)),
      createDetailItem("Carbs / serving", `${formatNumber(totals.serving.carbs)} g`),
      createDetailItem("Fat / serving", `${formatNumber(totals.serving.fat)} g`),
      createDetailItem("Adjusted", `${formatNumber(adjustment.targetServings, 0)} x ${formatGrams(adjustment.targetServingGrams)}`),
    );

    const actions = document.createElement("div");
    actions.className = "landing-card-actions";
    const editLink = document.createElement("a");
    editLink.className = "secondary-button";
    editLink.href = `index.html?recipe=${encodeURIComponent(recipe.id)}`;
    editLink.textContent = "Open in Recipes";
    actions.append(editLink);

    detail.append(detailGrid, actions);
    card.append(summary, detail);
    elements.landingRecipeGrid.append(card);
  });
}

function renderSummary(recipe) {
  const totals = adjustedTotalsForRecipe(recipe);
  const recipeItems = [
    ["Price", formatCurrency(totals.recipe.price)],
    ["Weight", formatGrams(totals.recipe.weight)],
    ["Calories", formatNumber(totals.recipe.calories, 0)],
    ["Protein", `${formatNumber(totals.recipe.protein)} g`],
    ["Carbs", `${formatNumber(totals.recipe.carbs)} g`],
    ["Fat", `${formatNumber(totals.recipe.fat)} g`],
  ];
  const servingItems = [
    ["Price", formatCurrency(totals.serving.price)],
    ["Weight", formatGrams(totals.serving.weight)],
    ["Calories", formatNumber(totals.serving.calories, 0)],
    ["Protein", `${formatNumber(totals.serving.protein)} g`],
    ["Carbs", `${formatNumber(totals.serving.carbs)} g`],
    ["Fat", `${formatNumber(totals.serving.fat)} g`],
  ];

  renderSummaryGroup(elements.recipeTotalsGrid, recipeItems);
  renderSummaryGroup(elements.servingTotalsGrid, servingItems);
}

function adjustedTotalsForRecipe(recipe, adjustment = activeAdjustmentForRecipe(recipe)) {
  const totals = totalsForRecipe(recipe);
  const targetServings = adjustment.targetServings;
  const factor = adjustment.scaleFactor;
  const adjustedRecipe = {
    weight: totals.recipe.weight * factor,
    price: totals.recipe.price * factor,
    calories: totals.recipe.calories * factor,
    protein: totals.recipe.protein * factor,
    carbs: totals.recipe.carbs * factor,
    fat: totals.recipe.fat * factor,
  };

  return {
    recipe: adjustedRecipe,
    serving: {
      weight: adjustedRecipe.weight / targetServings,
      price: adjustedRecipe.price / targetServings,
      calories: adjustedRecipe.calories / targetServings,
      protein: adjustedRecipe.protein / targetServings,
      carbs: adjustedRecipe.carbs / targetServings,
      fat: adjustedRecipe.fat / targetServings,
    },
  };
}

function renderSummaryGroup(container, items) {
  container.innerHTML = "";
  items.forEach(([label, value]) => {
    container.append(createSummaryItem(label, value));
  });
}

function resetScaleControls(recipe) {
  const totals = totalsForRecipe(recipe);
  elements.targetServings.value = formatWholeInputNumber(recipe.servings);
  elements.targetServingGrams.value = totals.serving.weight ? formatInputNumber(totals.serving.weight) : "";
  state.lastScaleInput = "servings";
  state.scaleFactor = 1;
}

function applySavedScaleControls(recipe) {
  if (!recipe.adjustment) {
    resetScaleControls(recipe);
    return;
  }

  elements.targetServings.value = formatWholeInputNumber(recipe.adjustment.targetServings);
  elements.targetServingGrams.value = formatInputNumber(Number(recipe.adjustment.targetServingGrams) || 0);
  state.lastScaleInput = recipe.adjustment.lastScaleInput === "servingGrams" ? "servingGrams" : "servings";
  state.scaleFactor = Number(recipe.adjustment.scaleFactor) > 0 ? Number(recipe.adjustment.scaleFactor) : 1;
}

function targetServingsForRecipe(recipe) {
  const fallback = Math.max(Math.round(Number(recipe.servings) || 1), 1);
  const parsed = Number.parseFloat(elements.targetServings.value);
  return Number.isFinite(parsed) ? Math.max(Math.round(parsed), 1) : fallback;
}

function scaleFactorForRecipe(recipe) {
  const totals = totalsForRecipe(recipe);
  const targetServings = targetServingsForRecipe(recipe);
  const targetServingGrams = numberFromInput(elements.targetServingGrams);

  if (totals.recipe.weight > 0 && targetServingGrams > 0) {
    return (targetServings * targetServingGrams) / totals.recipe.weight;
  }

  return targetServings / Math.max(Number(recipe.servings) || 1, 0.01);
}

function syncScaleControls(recipe) {
  if (state.lastScaleInput === "servingGrams") {
    updateServingsFromServingGrams(recipe);
  }

  const targetServings = targetServingsForRecipe(recipe);

  if (elements.targetServings.value !== targetServings.toString()) {
    elements.targetServings.value = targetServings.toString();
  }

  state.scaleFactor = scaleFactorForRecipe(recipe);
}

function updateServingsFromServingGrams(recipe) {
  const totals = totalsForRecipe(recipe);
  const targetServingGrams = numberFromInput(elements.targetServingGrams);
  const adjustedWeight = totals.recipe.weight * (Number(state.scaleFactor) > 0 ? Number(state.scaleFactor) : 1);

  if (adjustedWeight > 0 && targetServingGrams > 0) {
    elements.targetServings.value = Math.max(Math.round(adjustedWeight / targetServingGrams), 1).toString();
  }
}

function renderScaledIngredients(recipe) {
  const targetServings = targetServingsForRecipe(recipe);
  const factor = scaleFactorForRecipe(recipe);
  const totalWeight = totalsForRecipe(recipe).recipe.weight * factor;
  const targetServingGrams = totalWeight / targetServings;

  elements.scaleHelp.textContent = `Scaled batch: ${targetServings} servings at ${formatGrams(targetServingGrams)} each.`;
  elements.scaledRows.innerHTML = "";

  if (!recipe.ingredients.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "Add ingredients to see scaled amounts.";
    row.append(cell);
    elements.scaledRows.append(row);
    return;
  }

  recipe.ingredients.forEach((ingredient) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const scaledCell = document.createElement("td");

    nameCell.textContent = ingredient.name || "Unnamed ingredient";
    scaledCell.textContent = formatGrams(ingredient.amount * factor);

    row.append(nameCell, scaledCell);
    elements.scaledRows.append(row);
  });
}

function renderOutputs() {
  const recipe = currentRecipe();
  syncScaleControls(recipe);
  renderSummary(recipe);
  renderScaledIngredients(recipe);
}

function renderAll() {
  renderDashboard();
  renderOutputs();
}

function bindBuilderEvents() {
  document.addEventListener("keydown", (event) => {
    const inputTypes = ["number", "text"];
    const target = event.target;

    if (event.key === "Enter" && target instanceof HTMLInputElement && inputTypes.includes(target.type)) {
      event.preventDefault();
      target.blur();
      renderOutputs();
    }
  });

  elements.addIngredientButton.addEventListener("click", () => {
    addIngredientRow();
    renderOutputs();
  });

  elements.addSavedIngredientButton.addEventListener("click", addSelectedSavedIngredient);

  elements.newRecipeButton.addEventListener("click", newRecipe);

  elements.deleteRecipeButton.addEventListener("click", deleteCurrentRecipe);

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.ingredientRows.children.length) {
      addIngredientRow();
    }
    upsertCurrentRecipe();
  });

  [elements.recipeName, elements.recipeServings].forEach((input) => {
    input.addEventListener("input", renderOutputs);
  });

  elements.targetServings.addEventListener("input", () => {
    state.lastScaleInput = "servings";
    renderOutputs();
  });

  elements.targetServingGrams.addEventListener("input", () => {
    state.lastScaleInput = "servingGrams";
    updateServingsFromServingGrams(currentRecipe());
    renderOutputs();
  });

  elements.resetScaleButton.addEventListener("click", () => {
    const recipe = currentRecipe();
    resetScaleControls(recipe);
    renderOutputs();
  });
}

function getInitialBuilderRecipe() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("recipe");
  const requestedRecipe = state.recipes.find((recipe) => recipe.id === requestedId);

  return requestedRecipe || state.recipes[0] || null;
}

function init() {
  loadRecipes();
  loadSavedIngredients();

  if (elements.form) {
    bindBuilderEvents();
    renderSavedIngredientOptions();
    const initialRecipe = getInitialBuilderRecipe();

    if (initialRecipe) {
      setFormRecipe(initialRecipe);
    } else {
      newRecipe();
    }
  }

  if (elements.landingRecipeGrid) {
    renderLandingDashboard();
  }
}

init();
