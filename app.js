const STORAGE_KEY = "recipe-cost-nutrition-planner";
const INGREDIENT_STORAGE_KEY = "recipe-cost-nutrition-ingredients";

const state = {
  recipes: [],
  savedIngredients: [],
  subRecipes: [],
  selectedId: null,
  draftId: null,
  isDirty: false,
  lastScaleInput: "servings",
  scaleFactor: 1,
};

const elements = {
  form: document.querySelector("#recipeForm"),
  recipeName: document.querySelector("#recipeName"),
  savedRecipeNames: document.querySelector("#savedRecipeNames"),
  recipeServings: document.querySelector("#recipeServings"),
  ingredientRows: document.querySelector("#ingredientRows"),
  ingredientRowTemplate: document.querySelector("#ingredientRowTemplate"),
  addIngredientButton: document.querySelector("#addIngredientButton"),
  addIngredientPicker: document.querySelector("#addIngredientPicker"),
  createIngredientButton: document.querySelector("#createIngredientButton"),
  savedIngredientSelect: document.querySelector("#savedIngredientSelect"),
  savedIngredientNames: document.querySelector("#savedIngredientNames"),
  addSavedIngredientButton: document.querySelector("#addSavedIngredientButton"),
  newRecipeButton: document.querySelector("#newRecipeButton"),
  deleteRecipeButton: document.querySelector("#deleteRecipeButton"),
  saveRecipeButton: document.querySelector("#saveRecipeButton"),
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
  combinerRecipeSelect: document.querySelector("#combinerRecipeSelect"),
  addSubRecipeButton: document.querySelector("#addSubRecipeButton"),
  combinedRecipeGrid: document.querySelector("#combinedRecipeGrid"),
  combinedServingGrid: document.querySelector("#combinedServingGrid"),
  subRecipeRows: document.querySelector("#subRecipeRows"),
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

function formatPreciseInputNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number(value.toFixed(10)).toString();
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

const UNIT_OPTIONS = [
  { value: "g", label: "g" },
  { value: "cup", label: "cup" },
  { value: "tbsp", label: "tbsp" },
  { value: "tsp", label: "tsp" },
  { value: "oz", label: "oz" },
  { value: "lb", label: "lb" },
  { value: "piece", label: "piece" },
];

const FIXED_GRAMS_PER_UNIT = {
  g: 1,
  oz: 28.35,
  lb: 453.59,
};

const NAMED_CONVERSIONS = [
  { pattern: /\begg white\b/i, unit: "piece", gramsPerUnit: 33 },
  { pattern: /\begg yolk\b/i, unit: "piece", gramsPerUnit: 17 },
  { pattern: /\beggs?\b/i, unit: "piece", gramsPerUnit: 50 },
  { pattern: /\bflour\b/i, unit: "cup", gramsPerUnit: 120 },
  { pattern: /\bpowdered sugar\b|\bicing sugar\b|\bconfectioners sugar\b/i, unit: "cup", gramsPerUnit: 120 },
  { pattern: /\bbrown sugar\b/i, unit: "cup", gramsPerUnit: 213 },
  { pattern: /\bsugar\b/i, unit: "cup", gramsPerUnit: 200 },
  { pattern: /\bbutter\b/i, unit: "tbsp", gramsPerUnit: 14.2 },
  { pattern: /\bmilk\b|\bwater\b/i, unit: "cup", gramsPerUnit: 240 },
  { pattern: /\bmaple syrup\b|\bsyrup\b|\bhoney\b/i, unit: "tbsp", gramsPerUnit: 20 },
  { pattern: /\boil\b/i, unit: "tbsp", gramsPerUnit: 13.6 },
  { pattern: /\bsalt\b/i, unit: "tsp", gramsPerUnit: 6 },
  { pattern: /\bvanilla\b|\bextract\b/i, unit: "tsp", gramsPerUnit: 4.3 },
  { pattern: /\bbaking powder\b|\bbaking soda\b/i, unit: "tsp", gramsPerUnit: 4.6 },
];

const GENERIC_GRAMS_PER_UNIT = {
  cup: 240,
  tbsp: 15,
  tsp: 5,
  piece: 1,
};

function conversionForIngredient(name = "", preferredUnit = "") {
  const fixedValue = FIXED_GRAMS_PER_UNIT[preferredUnit];
  if (fixedValue) {
    return {
      unit: preferredUnit,
      gramsPerUnit: fixedValue,
    };
  }

  const match = NAMED_CONVERSIONS.find((conversion) => conversion.pattern.test(name));
  if (match) {
    if (!preferredUnit || preferredUnit === match.unit) {
      return {
        unit: match.unit,
        gramsPerUnit: match.gramsPerUnit,
      };
    }

    const related = gramsPerUnitForRelatedMeasure(match.unit, match.gramsPerUnit, preferredUnit);
    if (related) {
      return {
        unit: preferredUnit,
        gramsPerUnit: related,
      };
    }
  }

  return {
    unit: preferredUnit || "g",
    gramsPerUnit: GENERIC_GRAMS_PER_UNIT[preferredUnit] || 1,
  };
}

function gramsPerUnitForRelatedMeasure(sourceUnit, sourceGrams, targetUnit) {
  const toCup = {
    cup: 1,
    tbsp: 16,
    tsp: 48,
  };

  if (!toCup[sourceUnit] || !toCup[targetUnit]) {
    return null;
  }

  const gramsPerCup = sourceGrams * toCup[sourceUnit];
  return gramsPerCup / toCup[targetUnit];
}

function gramsFromQuantity(quantity, unit, gramsPerUnit) {
  if (unit === "g") {
    return quantity;
  }

  return quantity * Math.max(Number(gramsPerUnit) || 1, 0.01);
}

function displayQuantityFromGrams(grams, unit, gramsPerUnit) {
  if (unit === "g") {
    return grams;
  }

  return grams / Math.max(Number(gramsPerUnit) || 1, 0.01);
}

function unitLabel(unit, quantity, ingredientName = "") {
  if (unit === "piece") {
    const isSingle = Math.abs(quantity - 1) < 0.005;
    if (/\beggs?\b/i.test(ingredientName)) {
      return isSingle ? "egg" : "eggs";
    }

    return isSingle ? "piece" : "pieces";
  }

  if (unit === "cup") {
    return Math.abs(quantity - 1) < 0.005 ? "cup" : "cups";
  }

  return unit;
}

function formatIngredientAmount(ingredient, grams) {
  const unit = ingredient.unit || "g";
  const gramsPerUnit = Number(ingredient.gramsPerUnit) || 1;

  if (unit === "g") {
    return formatGrams(grams);
  }

  const quantity = displayQuantityFromGrams(grams, unit, gramsPerUnit);
  return `${formatNumber(quantity)} ${unitLabel(unit, quantity, ingredient.name)} (${formatGrams(grams)})`;
}

function normalizeIngredient(ingredient = {}) {
  const name = ingredient.name || "";
  const unit = ingredient.unit || "g";
  const conversion = conversionForIngredient(name, unit);
  const gramsPerUnit =
    unit === "g" ? 1 : Math.max(Number(ingredient.gramsPerUnit) || conversion.gramsPerUnit || 1, 0.01);
  const quantity =
    ingredient.quantity === undefined || ingredient.quantity === null
      ? displayQuantityFromGrams(Number(ingredient.amount) || 0, unit, gramsPerUnit)
      : Number(ingredient.quantity) || 0;

  return {
    name,
    quantity,
    unit,
    gramsPerUnit,
    amount: gramsFromQuantity(quantity, unit, gramsPerUnit),
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
  const name = ingredient.name || "";
  const conversion = conversionForIngredient(name, ingredient.unit || "");
  const unit = ingredient.unit || conversion.unit || "g";
  const gramsPerUnit =
    unit === "g" ? 1 : Math.max(Number(ingredient.gramsPerUnit) || conversion.gramsPerUnit || 1, 0.01);

  return {
    id: ingredient.id || createId(),
    name,
    unit,
    gramsPerUnit,
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
    quantity: 0,
    unit: ingredient.unit,
    gramsPerUnit: ingredient.gramsPerUnit,
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
  const id = state.selectedId || state.draftId || createId();
  if (!state.selectedId && !state.draftId) {
    state.draftId = id;
  }

  const ingredients = [...elements.ingredientRows.querySelectorAll(".ingredient-row")].map(ingredientFromRow);
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

function findSavedRecipeByName(name) {
  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return state.recipes.find((recipe) => recipe.name.toLowerCase() === normalizedName) || null;
}

function renderRecipeNameOptions() {
  if (!elements.savedRecipeNames) {
    return;
  }

  elements.savedRecipeNames.innerHTML = "";
  state.recipes.forEach((recipe) => {
    const option = document.createElement("option");
    option.value = recipe.name || "Untitled recipe";
    elements.savedRecipeNames.append(option);
  });
}

function currentPageName() {
  return document.body.dataset.page || "";
}

function isMakeWorkspace() {
  return currentPageName() === "make";
}

function updateSaveButtonState() {
  if (!elements.saveRecipeButton) {
    return;
  }

  if (!state.selectedId) {
    elements.saveRecipeButton.textContent = "Save";
    elements.saveRecipeButton.disabled = false;
    return;
  }

  elements.saveRecipeButton.textContent = state.isDirty ? "Save Changes" : "Saved";
  elements.saveRecipeButton.disabled = !state.isDirty;
}

function markDirty() {
  state.isDirty = true;
  updateSaveButtonState();
}

function recognizeRecipeNameState() {
  if (!isMakeWorkspace()) {
    markDirty();
    renderOutputs();
    return;
  }

  const name = elements.recipeName.value.trim();
  const matchedRecipe = findSavedRecipeByName(name);

  if (matchedRecipe && matchedRecipe.id === state.selectedId && !state.isDirty) {
    updateSaveButtonState();
    return;
  }

  if (matchedRecipe && matchedRecipe.id !== state.selectedId) {
    setFormRecipe(matchedRecipe);
    return;
  }

  if (!matchedRecipe && state.selectedId) {
    state.selectedId = null;
    state.draftId = createId();
  }

  markDirty();
  renderOutputs();
}

function ingredientFromRow(row) {
  const priceValue = row.querySelector(".ingredient-price").value.trim();
  const unit = row.querySelector(".ingredient-unit").value;
  const gramsPerUnit = unit === "g" ? 1 : Math.max(numberFromInput(row.querySelector(".ingredient-grams-per-unit")), 0.01);

  return normalizeIngredient({
    name: row.querySelector(".ingredient-name").value.trim(),
    quantity: numberFromInput(row.querySelector(".ingredient-quantity")),
    unit,
    gramsPerUnit,
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
    unit: ingredient.unit,
    gramsPerUnit: ingredient.gramsPerUnit,
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

  addIngredientRow(savedIngredientToRecipeIngredient(ingredient), { expanded: false });
  if (elements.addIngredientPicker) {
    elements.addIngredientPicker.hidden = true;
  }
  markDirty();
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
  const previousIngredient = ingredientFromRow(row);
  const unit = ingredient.unit || "g";
  const gramsPerUnit = unit === "g" ? 1 : ingredient.gramsPerUnit || 1;

  row.querySelector(".ingredient-unit").value = ingredient.unit || "g";
  row.querySelector(".ingredient-grams-per-unit").value = formatPreciseInputNumber(gramsPerUnit);
  if (previousIngredient.amount > 0) {
    row.querySelector(".ingredient-quantity").value = formatPreciseInputNumber(
      displayQuantityFromGrams(previousIngredient.amount, unit, gramsPerUnit),
    );
  }
  row.querySelector(".ingredient-price").value = ingredient.price === null ? "" : ingredient.price || "";
  row.querySelector(".ingredient-calories").value = ingredient.calories || "";
  row.querySelector(".ingredient-protein").value = ingredient.protein || "";
  row.querySelector(".ingredient-carbs").value = ingredient.carbs || "";
  row.querySelector(".ingredient-fat").value = ingredient.fat || "";
  syncRowConversionState(row);
}

function applyIngredientNameUpdate(row) {
  const nameInput = row.querySelector(".ingredient-name");
  const currentName = nameInput.value.trim();
  const lastName = row.dataset.lastIngredientName || "";

  if (currentName.toLowerCase() === lastName.toLowerCase()) {
    return;
  }

  const savedIngredient = findSavedIngredientByName(nameInput.value);

  if (savedIngredient) {
    nameInput.value = savedIngredient.name;
    applySavedNutritionToRow(row, savedIngredient);
  } else {
    suggestRowConversion(row);
  }

  row.dataset.lastIngredientName = nameInput.value.trim();
  renderOutputs();
}

function setUnitOptions(select) {
  select.innerHTML = "";
  UNIT_OPTIONS.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit.value;
    option.textContent = unit.label;
    select.append(option);
  });
}

function costForIngredient(ingredient) {
  return ingredient.price === null ? 0 : ingredient.price * (ingredient.amount / 100);
}

function updateIngredientRowSummary(row) {
  const cost = row.querySelector(".ingredient-cost");
  if (!cost) {
    return;
  }

  const ingredient = ingredientFromRow(row);
  cost.textContent = ingredient.price === null || !ingredient.amount ? "-" : formatCurrency(costForIngredient(ingredient));
}

function setIngredientRowExpanded(row, expanded) {
  const details = row.querySelector(".ingredient-details");
  const toggle = row.querySelector(".expand-ingredient");
  if (!details || !toggle) {
    return;
  }

  row.dataset.expanded = expanded ? "true" : "false";
  details.hidden = !expanded;
  toggle.textContent = expanded ? "-" : "+";
  toggle.setAttribute("aria-label", expanded ? "Collapse ingredient" : "Expand ingredient");
}

function suggestRowConversion(row) {
  const previousIngredient = ingredientFromRow(row);
  const name = row.querySelector(".ingredient-name").value;
  const quantityInput = row.querySelector(".ingredient-quantity");
  const unitInput = row.querySelector(".ingredient-unit");
  const gramsPerUnitInput = row.querySelector(".ingredient-grams-per-unit");
  const hasNamedConversion = NAMED_CONVERSIONS.some((conversion) => conversion.pattern.test(name));

  if (!hasNamedConversion) {
    syncRowConversionState(row);
    return;
  }

  const conversion = conversionForIngredient(name, "");

  unitInput.value = conversion.unit;
  gramsPerUnitInput.value = formatPreciseInputNumber(conversion.gramsPerUnit);
  quantityInput.value = previousIngredient.amount
    ? formatPreciseInputNumber(displayQuantityFromGrams(previousIngredient.amount, conversion.unit, conversion.gramsPerUnit))
    : quantityInput.value;
  syncRowConversionState(row);
}

function syncRowConversionState(row) {
  const ingredient = ingredientFromRow(row);
  const unitInput = row.querySelector(".ingredient-unit");
  const gramsPerUnitInput = row.querySelector(".ingredient-grams-per-unit");
  const note = row.querySelector(".amount-note");

  gramsPerUnitInput.disabled = unitInput.value === "g";
  if (unitInput.value === "g") {
    gramsPerUnitInput.value = "1";
  }

  note.textContent = ingredient.amount ? `${formatGrams(ingredient.amount)} total` : "0 g total";
  row.dataset.currentUnit = unitInput.value;
  updateIngredientRowSummary(row);
}

function gramsBeforeUnitChange(row, nextUnit) {
  const previousUnit = row.dataset.currentUnit || "g";
  const quantity = numberFromInput(row.querySelector(".ingredient-quantity"));
  const gramsPerUnit = previousUnit === "g" ? 1 : numberFromInput(row.querySelector(".ingredient-grams-per-unit"));

  if (previousUnit === nextUnit) {
    return ingredientFromRow(row).amount;
  }

  return gramsFromQuantity(quantity, previousUnit, gramsPerUnit);
}

function addIngredientRow(ingredient = emptyIngredient(), options = {}) {
  const fragment = elements.ingredientRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".ingredient-row");
  const normalizedIngredient = normalizeIngredient(ingredient);

  setUnitOptions(row.querySelector(".ingredient-unit"));
  row.querySelector(".ingredient-name").value = normalizedIngredient.name || "";
  row.querySelector(".ingredient-quantity").value = normalizedIngredient.quantity || "";
  row.querySelector(".ingredient-unit").value = normalizedIngredient.unit || "g";
  row.querySelector(".ingredient-grams-per-unit").value = formatPreciseInputNumber(normalizedIngredient.gramsPerUnit || 1);
  row.querySelector(".ingredient-price").value = normalizedIngredient.price === null ? "" : normalizedIngredient.price || "";
  row.querySelector(".ingredient-calories").value = normalizedIngredient.calories || "";
  row.querySelector(".ingredient-protein").value = normalizedIngredient.protein || "";
  row.querySelector(".ingredient-carbs").value = normalizedIngredient.carbs || "";
  row.querySelector(".ingredient-fat").value = normalizedIngredient.fat || "";
  row.dataset.lastIngredientName = normalizedIngredient.name || "";

  row.querySelector(".ingredient-name").addEventListener("change", () => {
    applyIngredientNameUpdate(row);
    markDirty();
  });

  row.querySelector(".ingredient-name").addEventListener("blur", () => {
    applyIngredientNameUpdate(row);
  });

  const expandButton = row.querySelector(".expand-ingredient");
  if (expandButton) {
    expandButton.addEventListener("click", () => {
      setIngredientRowExpanded(row, row.dataset.expanded !== "true");
    });
  }

  const unitInput = row.querySelector(".ingredient-unit");
  unitInput.addEventListener("change", () => {
    const name = row.querySelector(".ingredient-name").value;
    const previousGrams = gramsBeforeUnitChange(row, unitInput.value);
    const conversion = conversionForIngredient(name, unitInput.value);

    row.querySelector(".ingredient-grams-per-unit").value = formatPreciseInputNumber(conversion.gramsPerUnit);
    if (Number.isFinite(previousGrams) && previousGrams > 0) {
      row.querySelector(".ingredient-quantity").value = formatPreciseInputNumber(
        displayQuantityFromGrams(previousGrams, unitInput.value, conversion.gramsPerUnit),
      );
    }

    syncRowConversionState(row);
    markDirty();
    renderOutputs();
  });

  row.querySelector(".ingredient-quantity").addEventListener("input", () => {
    syncRowConversionState(row);
  });

  row.querySelector(".ingredient-grams-per-unit").addEventListener("input", () => {
    syncRowConversionState(row);
  });

  row.querySelector(".save-ingredient").addEventListener("click", () => {
    saveIngredientFromRow(row);
  });

  row.querySelector(".remove-ingredient").addEventListener("click", () => {
    row.remove();
    if (!elements.ingredientRows.children.length) {
      if (isMakeWorkspace()) {
        renderOutputs();
      } else {
        addIngredientRow();
      }
    }
    markDirty();
    renderOutputs();
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      markDirty();
      renderOutputs();
    });
  });

  elements.ingredientRows.append(row);
  syncRowConversionState(row);
  setIngredientRowExpanded(row, Boolean(options.expanded));
}

function setFormRecipe(recipe, options = {}) {
  const saved = options.saved !== false;
  state.selectedId = saved ? recipe.id : null;
  state.draftId = saved ? null : recipe.id;
  state.isDirty = false;
  elements.recipeName.value = recipe.name;
  elements.recipeServings.value = recipe.servings;
  elements.ingredientRows.innerHTML = "";

  const ingredients = recipe.ingredients.length || isMakeWorkspace() ? recipe.ingredients : [emptyIngredient()];
  ingredients.forEach(addIngredientRow);

  applySavedScaleControls(recipe);
  renderAll();
  updateSaveButtonState();
}

function newRecipe() {
  const recipe = {
    id: createId(),
    name: "",
    servings: isMakeWorkspace() ? 1 : 4,
    ingredients: isMakeWorkspace() ? [] : [emptyIngredient()],
    adjustment: null,
    updatedAt: new Date().toISOString(),
  };

  setFormRecipe(recipe, { saved: false });
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
  state.draftId = null;
  state.isDirty = false;
  saveRecipes();
  renderRecipeNameOptions();
  renderAll();
  updateSaveButtonState();
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
  if (!elements.recipeDashboard || !elements.recipeCount) {
    return;
  }

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

function zeroTotals() {
  return {
    weight: 0,
    price: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
}

function addTotals(target, source, multiplier = 1) {
  target.weight += source.weight * multiplier;
  target.price += source.price * multiplier;
  target.calories += source.calories * multiplier;
  target.protein += source.protein * multiplier;
  target.carbs += source.carbs * multiplier;
  target.fat += source.fat * multiplier;
}

function renderCombinerOptions() {
  if (!elements.combinerRecipeSelect) {
    return;
  }

  elements.combinerRecipeSelect.innerHTML = "";

  if (!state.recipes.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved recipes";
    elements.combinerRecipeSelect.append(option);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose recipe";
  elements.combinerRecipeSelect.append(placeholder);

  state.recipes.forEach((recipe) => {
    const option = document.createElement("option");
    option.value = recipe.id;
    option.textContent = recipe.name || "Untitled recipe";
    elements.combinerRecipeSelect.append(option);
  });
}

function addSelectedSubRecipe() {
  if (!elements.combinerRecipeSelect.value) {
    elements.combinerRecipeSelect.focus();
    return;
  }

  state.subRecipes.push({
    id: elements.combinerRecipeSelect.value,
    batches: 1,
  });
  markDirty();
  renderRecipeCombiner();
}

function subRecipeEntries() {
  return state.subRecipes
    .map((subRecipe, index) => {
      const recipe = state.recipes.find((item) => item.id === subRecipe.id);

      if (!recipe) {
        return null;
      }

      const batches = Math.max(Number(subRecipe.batches) || 1, 0.01);
      const adjustment = savedAdjustmentForRecipe(recipe);
      const totals = adjustedTotalsForRecipe(recipe, adjustment);

      return {
        index,
        recipe,
        batches,
        adjustment,
        totals,
      };
    })
    .filter(Boolean);
}

function combinedRecipeTotals(entries) {
  const totals = zeroTotals();
  const servingTotals = zeroTotals();
  const servings = entries.length
    ? Math.min(...entries.map((entry) => entry.adjustment.targetServings * entry.batches))
    : 0;

  entries.forEach((entry) => {
    addTotals(totals, entry.totals.recipe, entry.batches);
    addTotals(servingTotals, entry.totals.serving);
  });

  return {
    recipe: totals,
    servings,
    serving: servingTotals,
  };
}

function renderCombinedSummary(totals) {
  elements.combinedRecipeGrid.innerHTML = "";
  elements.combinedServingGrid.innerHTML = "";

  const recipeItems = [
    ["Total price", formatCurrency(totals.recipe.price)],
    ["Total weight", formatGrams(totals.recipe.weight)],
    ["Total calories", formatNumber(totals.recipe.calories, 0)],
    ["Total protein", `${formatNumber(totals.recipe.protein)} g`],
    ["Total carbs", `${formatNumber(totals.recipe.carbs)} g`],
    ["Total fat", `${formatNumber(totals.recipe.fat)} g`],
  ];
  const servingItems = [
    ["Price / serving", formatCurrency(totals.serving.price)],
    ["Weight / serving", formatGrams(totals.serving.weight)],
    ["Calories / serving", formatNumber(totals.serving.calories, 0)],
    ["Protein / serving", `${formatNumber(totals.serving.protein)} g`],
    ["Carbs / serving", `${formatNumber(totals.serving.carbs)} g`],
    ["Fat / serving", `${formatNumber(totals.serving.fat)} g`],
  ];

  recipeItems.forEach(([label, value]) => {
    elements.combinedRecipeGrid.append(createSummaryItem(label, value));
  });

  servingItems.forEach(([label, value]) => {
    elements.combinedServingGrid.append(createSummaryItem(label, value));
  });

  for (let index = servingItems.length; index < recipeItems.length; index += 1) {
    const spacer = document.createElement("div");
    spacer.className = "summary-item summary-item-spacer";
    spacer.setAttribute("aria-hidden", "true");
    elements.combinedServingGrid.append(spacer);
  }
}

function renderSubRecipeRows(entries) {
  elements.subRecipeRows.innerHTML = "";
  const compact = elements.subRecipeRows.classList.contains("compact");

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = compact ? "No sub-recipes added." : "Add saved recipes to see combined totals and sub-recipe breakdowns.";
    elements.subRecipeRows.append(empty);
    return;
  }

  const combinedServings = Math.min(...entries.map((entry) => entry.adjustment.targetServings * entry.batches));

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "sub-recipe-card";

    const header = document.createElement("div");
    header.className = "sub-recipe-header";
    const title = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = entry.recipe.name || "Untitled recipe";
    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = `${formatNumber(entry.adjustment.targetServings, 0)} servings per batch at ${formatGrams(entry.adjustment.targetServingGrams)} each`;
    title.append(name, meta);

    const controls = document.createElement("div");
    controls.className = "sub-recipe-controls";
    const label = document.createElement("label");
    label.textContent = "Batches";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.01";
    input.step = "0.01";
    input.value = formatInputNumber(entry.batches);
    input.addEventListener("change", () => {
      state.subRecipes[entry.index].batches = Math.max(Number.parseFloat(input.value) || 0.01, 0.01);
      renderRecipeCombiner();
    });
    label.append(input);

    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Remove ${entry.recipe.name || "sub-recipe"}`);
    remove.addEventListener("click", () => {
      state.subRecipes.splice(entry.index, 1);
      renderRecipeCombiner();
    });

    controls.append(label, remove);
    header.append(title, controls);

    if (compact) {
      card.append(header);
      elements.subRecipeRows.append(card);
      return;
    }

    const recipeTotals = zeroTotals();
    addTotals(recipeTotals, entry.totals.recipe, entry.batches);
    const servings = entry.adjustment.targetServings * entry.batches;
    const extraServings = Math.max(servings - combinedServings, 0);
    const detailGrid = document.createElement("div");
    detailGrid.className = "sub-recipe-breakdown";
    const detailItems = [
      ["Price", formatCurrency(recipeTotals.price)],
      ["Weight", formatGrams(recipeTotals.weight)],
      ["Servings", formatNumber(servings)],
      ["Calories", formatNumber(recipeTotals.calories, 0)],
      ["Protein", `${formatNumber(recipeTotals.protein)} g`],
      ["Carbs", `${formatNumber(recipeTotals.carbs)} g`],
      ["Fat", `${formatNumber(recipeTotals.fat)} g`],
      ["Price / serving", formatCurrency(servings ? recipeTotals.price / servings : 0)],
    ];

    if (extraServings > 0) {
      detailItems.push(["Extra servings", formatNumber(extraServings)]);
    }

    detailItems.forEach(([labelText, value]) => {
      detailGrid.append(createDetailItem(labelText, value));
    });

    card.append(header, detailGrid);
    elements.subRecipeRows.append(card);
  });
}

function renderRecipeCombiner() {
  if (!elements.subRecipeRows) {
    return;
  }

  const entries = subRecipeEntries();
  if (elements.combinedRecipeGrid && elements.combinedServingGrid) {
    renderCombinedSummary(combinedRecipeTotals(entries));
  }
  renderSubRecipeRows(entries);
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
    editLink.href = `dashboard.html?recipe=${encodeURIComponent(recipe.id)}`;
    editLink.textContent = "Open in Make & Calculate";
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
    scaledCell.textContent = formatIngredientAmount(ingredient, ingredient.amount * factor);

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
  renderRecipeCombiner();
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
    if (elements.addIngredientPicker) {
      elements.addIngredientPicker.hidden = !elements.addIngredientPicker.hidden;
      return;
    }

    addIngredientRow();
    markDirty();
    renderOutputs();
  });

  if (elements.addSavedIngredientButton) {
    elements.addSavedIngredientButton.addEventListener("click", addSelectedSavedIngredient);
  }

  if (elements.createIngredientButton) {
    elements.createIngredientButton.addEventListener("click", () => {
      addIngredientRow(emptyIngredient(), { expanded: true });
      elements.addIngredientPicker.hidden = true;
      markDirty();
      renderOutputs();
    });
  }

  if (elements.newRecipeButton) {
    elements.newRecipeButton.addEventListener("click", newRecipe);
  }

  if (elements.deleteRecipeButton) {
    elements.deleteRecipeButton.addEventListener("click", deleteCurrentRecipe);
  }

  if (elements.combinerRecipeSelect) {
    renderCombinerOptions();
  }

  if (elements.addSubRecipeButton) {
    elements.addSubRecipeButton.addEventListener("click", addSelectedSubRecipe);
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.ingredientRows.children.length && !isMakeWorkspace()) {
      addIngredientRow();
    }
    upsertCurrentRecipe();
  });

  elements.recipeName.addEventListener("input", recognizeRecipeNameState);
  elements.recipeName.addEventListener("change", recognizeRecipeNameState);

  [elements.recipeServings].forEach((input) => {
    input.addEventListener("input", () => {
      markDirty();
      renderOutputs();
    });
  });

  elements.targetServings.addEventListener("input", () => {
    state.lastScaleInput = "servings";
    markDirty();
    renderOutputs();
  });

  elements.targetServingGrams.addEventListener("input", () => {
    state.lastScaleInput = "servingGrams";
    updateServingsFromServingGrams(currentRecipe());
    markDirty();
    renderOutputs();
  });

  elements.resetScaleButton.addEventListener("click", () => {
    const recipe = currentRecipe();
    resetScaleControls(recipe);
    markDirty();
    renderOutputs();
  });
}

function getInitialBuilderRecipe() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("recipe");
  const requestedRecipe = state.recipes.find((recipe) => recipe.id === requestedId);

  if (isMakeWorkspace()) {
    return requestedRecipe || null;
  }

  return requestedRecipe || state.recipes[0] || null;
}

function init() {
  loadRecipes();
  loadSavedIngredients();

  if (elements.form) {
    bindBuilderEvents();
    renderRecipeNameOptions();
    renderSavedIngredientOptions();
    const initialRecipe = getInitialBuilderRecipe();

    if (initialRecipe) {
      setFormRecipe(initialRecipe);
    } else {
      newRecipe();
    }
  }

  if (elements.landingRecipeGrid) {
    renderCombinerOptions();
    renderRecipeCombiner();
    if (elements.addSubRecipeButton) {
      elements.addSubRecipeButton.addEventListener("click", addSelectedSubRecipe);
    }
    renderLandingDashboard();
  }
}

init();
