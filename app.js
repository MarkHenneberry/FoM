const STORAGE_KEY = "recipe-cost-nutrition-planner";
const INGREDIENT_STORAGE_KEY = "recipe-cost-nutrition-ingredients";

const state = {
  recipes: [],
  savedIngredients: [],
  selectedId: null,
  draftId: null,
  isDirty: false,
  lastScaleInput: "servings",
  scaleFactor: 1,
  batchBreakdownExpanded: {},
};

const elements = {
  form: document.querySelector("#recipeForm"),
  recipeName: document.querySelector("#recipeName"),
  savedRecipeNames: document.querySelector("#savedRecipeNames"),
  recipeServings: document.querySelector("#recipeServings"),
  ingredientRows: document.querySelector("#ingredientRows"),
  componentRowTemplate: document.querySelector("#componentRowTemplate"),
  ingredientRowTemplate: document.querySelector("#ingredientRowTemplate"),
  addIngredientButton: document.querySelector("#addIngredientButton"),
  savedIngredientSelect: document.querySelector("#savedIngredientSelect"),
  savedIngredientNames: document.querySelector("#savedIngredientNames"),
  addSavedIngredientButton: document.querySelector("#addSavedIngredientButton"),
  newRecipeButton: document.querySelector("#newRecipeButton"),
  deleteRecipeButton: document.querySelector("#deleteRecipeButton"),
  saveRecipeButton: document.querySelector("#saveRecipeButton"),
  recipeDashboard: document.querySelector("#recipeDashboard"),
  recipeCount: document.querySelector("#recipeCount"),
  servingTotalsGrid: document.querySelector("#servingTotalsGrid"),
  sellingPriceInput: document.querySelector("#sellingPriceInput"),
  sellingTotalsGrid: document.querySelector("#sellingTotalsGrid"),
  batchTotalsGrid: document.querySelector("#batchTotalsGrid"),
  targetServings: document.querySelector("#targetServings"),
  targetServingGrams: document.querySelector("#targetServingGrams"),
  resetScaleButton: document.querySelector("#resetScaleButton"),
  scaleHelp: document.querySelector("#scaleHelp"),
  scaledRows: document.querySelector("#scaledRows"),
  landingRecipeGrid: document.querySelector("#landingRecipeGrid"),
  landingRecipeCount: document.querySelector("#landingRecipeCount"),
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

function normalizeSearchText(value) {
  return value.trim().toLowerCase();
}

function persistedSavedIngredientId(ingredient = {}) {
  return ingredient.savedIngredientId || ingredient.libraryIngredientId || null;
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

function formatPercentage(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${formatNumber(value * 100)}%`;
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
  const priceMissing = ingredient.price === "" || ingredient.price === null || ingredient.price === undefined;
  const savedIngredientId = persistedSavedIngredientId(ingredient);
  const gramsPerUnit =
    unit === "g" ? 1 : Math.max(Number(ingredient.gramsPerUnit) || conversion.gramsPerUnit || 1, 0.01);
  const quantity =
    ingredient.quantity === undefined || ingredient.quantity === null
      ? displayQuantityFromGrams(Number(ingredient.amount) || 0, unit, gramsPerUnit)
      : Number(ingredient.quantity) || 0;

  return {
    name,
    savedIngredientId,
    libraryIngredientId: savedIngredientId,
    quantity,
    unit,
    gramsPerUnit,
    amount: gramsFromQuantity(quantity, unit, gramsPerUnit),
    price: priceMissing ? null : Number(ingredient.price) || 0,
    calories: Number(ingredient.calories) || 0,
    protein: Number(ingredient.protein) || 0,
    carbs: Number(ingredient.carbs) || 0,
    fat: Number(ingredient.fat) || 0,
  };
}

function emptyIngredient() {
  return normalizeIngredient();
}

function ingredientToComponent(ingredient = {}) {
  const normalizedIngredient = normalizeIngredient(ingredient);
  return {
    id: ingredient.id || createId(),
    type: "ingredient",
    name: normalizedIngredient.name,
    savedIngredientId: normalizedIngredient.savedIngredientId,
    libraryIngredientId: normalizedIngredient.savedIngredientId,
    quantity: normalizedIngredient.quantity,
    unit: normalizedIngredient.unit,
    gramsPerUnit: normalizedIngredient.gramsPerUnit,
    amount: normalizedIngredient.amount,
    price: normalizedIngredient.price,
    calories: normalizedIngredient.calories,
    protein: normalizedIngredient.protein,
    carbs: normalizedIngredient.carbs,
    fat: normalizedIngredient.fat,
  };
}

function legacyIngredientFromComponent(component = {}) {
  const ingredient = normalizeIngredient(component);
  return {
    name: ingredient.name,
    savedIngredientId: ingredient.savedIngredientId,
    libraryIngredientId: ingredient.savedIngredientId,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    gramsPerUnit: ingredient.gramsPerUnit,
    amount: ingredient.amount,
    price: ingredient.price,
    calories: ingredient.calories,
    protein: ingredient.protein,
    carbs: ingredient.carbs,
    fat: ingredient.fat,
  };
}

function normalizeNestedRecipeData(recipe = {}) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.map(normalizeIngredient) : [];
  return {
    name: recipe.name || "",
    servings: Math.max(Number(recipe.servings) || 1, 1),
    ingredients,
  };
}

function normalizeComponent(component = {}) {
  const type = component.type || component.componentType || component.kind || "ingredient";

  if (type === "recipe" || type === "draft_recipe" || type === "ingredient_group") {
    const recipeData = normalizeNestedRecipeData(component.recipeData || component.recipe || {});
    return {
      id: component.id || createId(),
      type,
      name: component.name || recipeData.name || "Untitled recipe",
      sourceRecipeId: type === "recipe" ? component.sourceRecipeId || component.recipeId || null : null,
      quantity: type === "ingredient_group" ? 1 : Math.max(Number(component.quantity) || 1, 0.01),
      unit: type === "ingredient_group" ? "group" : "serving",
      baseIngredientGroup: Boolean(component.baseIngredientGroup),
      recipeData,
    };
  }

  return ingredientToComponent(component);
}

function componentTypeLabel(type) {
  if (type === "ingredient_group") {
    return "Ingredient Group";
  }

  if (type === "recipe") {
    return "Recipe";
  }

  if (type === "draft_recipe") {
    return "Draft Recipe";
  }

  return "Ingredient";
}

function directIngredientsForRecipeComponents(components = []) {
  return components.flatMap((component) => {
    const normalized = normalizeComponent(component);

    if (normalized.type === "ingredient") {
      return [legacyIngredientFromComponent(normalized)];
    }

    if (normalized.type === "ingredient_group") {
      return normalized.recipeData.ingredients.map(legacyIngredientFromComponent);
    }

    return [];
  });
}

function recipeComponents(recipe = {}) {
  if (Array.isArray(recipe.components) && recipe.components.length) {
    return recipe.components.map(normalizeComponent);
  }

  if (Array.isArray(recipe.ingredients)) {
    return recipe.ingredients.map(ingredientToComponent);
  }

  return [];
}

function emptyComponent() {
  return normalizeComponent({});
}

function normalizeSavedIngredient(ingredient = {}) {
  const name = ingredient.name || "";
  const conversion = conversionForIngredient(name, ingredient.unit || "");
  const unit = ingredient.unit || conversion.unit || "g";
  const priceMissing = ingredient.price === "" || ingredient.price === null || ingredient.price === undefined;
  const gramsPerUnit =
    unit === "g" ? 1 : Math.max(Number(ingredient.gramsPerUnit) || conversion.gramsPerUnit || 1, 0.01);

  return {
    id: ingredient.id || createId(),
    name,
    unit,
    gramsPerUnit,
    price: priceMissing ? null : Number(ingredient.price) || 0,
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
    savedIngredientId: ingredient.id,
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

function savedRecipeToComponent(recipe) {
  const hydratedRecipe = repairRecipeSavedIngredientLinks(recipe);
  const nestedIngredients = hydratedRecipe.ingredients.length
    ? hydratedRecipe.ingredients
    : directIngredientsForRecipeComponents(recipeComponents(hydratedRecipe));

  return normalizeComponent({
    type: "recipe",
    name: hydratedRecipe.name,
    sourceRecipeId: hydratedRecipe.id,
    quantity: 1,
    unit: "serving",
    recipeData: {
      name: hydratedRecipe.name,
      servings: hydratedRecipe.servings,
      ingredients: nestedIngredients,
    },
  });
}

function normalizeAdjustment(recipe) {
  const adjustment = recipe.adjustment || {};
  const originalTotals = totalsForRecipe({
    servings: Number(recipe.servings) || 1,
    components: recipeComponents(recipe),
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
  const components = recipeComponents(recipe);
  const normalized = {
    ...recipe,
    id: recipe.id || createId(),
    name: recipe.name || "Untitled recipe",
    servings: Number(recipe.servings) || 1,
    updatedAt: recipe.updatedAt || new Date().toISOString(),
    components,
    ingredients: directIngredientsForRecipeComponents(components),
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
  const totals = recipeComponents(recipe).reduce(
    (sum, ingredient) => {
      addTotals(sum, componentContributionTotals(ingredient));
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

  const components = [...elements.ingredientRows.querySelectorAll(".component-row")].map(componentFromRow);
  const servings = Math.max(numberFromInput(elements.recipeServings), 0.01);
  const draftTotals = totalsForRecipe({ servings, components });
  const targetServingGrams =
    (elements.targetServingGrams ? numberFromInput(elements.targetServingGrams) : 0) || draftTotals.serving.weight;
  const targetServings =
    elements.targetServings && currentPageName() === "make"
      ? targetServingsForRecipe({ servings, components })
      : Math.max(Math.round(servings), 1);

  return {
    id,
    name: elements.recipeName.value.trim() || "Untitled recipe",
    servings,
    updatedAt: new Date().toISOString(),
    components,
    ingredients: components.filter((component) => component.type === "ingredient").map(legacyIngredientFromComponent),
    adjustment: {
      targetServings,
      targetServingGrams,
      lastScaleInput: state.lastScaleInput,
      scaleFactor: targetServings / Math.max(servings, 0.01),
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

function repairRecipeIngredientSavedIdentity(ingredient = {}) {
  const normalizedIngredient = normalizeIngredient(ingredient);

  if (normalizedIngredient.savedIngredientId) {
    return normalizedIngredient;
  }

  const savedIngredient = findSavedIngredientByName(normalizedIngredient.name || "");
  if (!savedIngredient) {
    return normalizedIngredient;
  }

  return normalizeIngredient({
    ...normalizedIngredient,
    savedIngredientId: savedIngredient.id,
    libraryIngredientId: savedIngredient.id,
  });
}

function repairComponentSavedIdentity(component = {}) {
  const normalizedComponent = normalizeComponent(component);

  if (normalizedComponent.type === "ingredient") {
    return repairRecipeIngredientSavedIdentity(normalizedComponent);
  }

  return normalizeComponent({
    ...normalizedComponent,
    recipeData: {
      ...normalizedComponent.recipeData,
      ingredients: normalizedComponent.recipeData.ingredients.map(repairRecipeIngredientSavedIdentity),
    },
  });
}

function repairRecipeSavedIngredientLinks(recipe) {
  if (!recipe) {
    return recipe;
  }

  const originalComponents = recipeComponents(recipe);
  const repairedComponents = originalComponents.map(repairComponentSavedIdentity);
  const changed = repairedComponents.some((component, index) => {
    const original = normalizeComponent(originalComponents[index] || {});
    if (component.type !== original.type) {
      return true;
    }

    if (component.type === "ingredient") {
      return component.savedIngredientId !== original.savedIngredientId;
    }

    return component.recipeData.ingredients.some((ingredient, ingredientIndex) => {
      const originalIngredient = original.recipeData.ingredients[ingredientIndex] || {};
      return ingredient.savedIngredientId !== persistedSavedIngredientId(originalIngredient);
    });
  });

  if (!changed) {
    return recipe;
  }

  return normalizeRecipe({
    ...recipe,
    components: repairedComponents,
  });
}

function ingredientGroupNameForRecipe(recipeName = "") {
  return `${recipeName || "Untitled recipe"} Ingredients`;
}

function withBaseIngredientGroup(recipe) {
  const normalizedRecipe = normalizeRecipe(recipe);
  const components = recipeComponents(normalizedRecipe);
  const hasGroup = components.some((component) => component.type === "ingredient_group");

  if (hasGroup) {
    return normalizeRecipe({
      ...normalizedRecipe,
      components: components.map((component) => {
        if (component.type !== "ingredient_group" || !component.baseIngredientGroup) {
          return component;
        }

        return normalizeComponent({
          ...component,
          name: ingredientGroupNameForRecipe(normalizedRecipe.name),
          baseIngredientGroup: true,
          recipeData: {
            ...component.recipeData,
            name: ingredientGroupNameForRecipe(normalizedRecipe.name),
          },
        });
      }),
    });
  }

  const ingredientComponents = components.filter((component) => component.type === "ingredient");
  if (!ingredientComponents.length) {
    return normalizedRecipe;
  }

  const otherComponents = components.filter((component) => component.type !== "ingredient");
  const groupName = ingredientGroupNameForRecipe(normalizedRecipe.name);
  const groupComponent = normalizeComponent({
    id: `${normalizedRecipe.id}-base-ingredients`,
    type: "ingredient_group",
    name: groupName,
    baseIngredientGroup: true,
    recipeData: {
      name: groupName,
      servings: normalizedRecipe.servings,
      ingredients: ingredientComponents.map(legacyIngredientFromComponent),
    },
  });

  return normalizeRecipe({
    ...normalizedRecipe,
    components: [groupComponent, ...otherComponents],
  });
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

function rankAutocompleteMatches(items, query, getLabel) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return items
      .map((item) => ({ item, label: getLabel(item) }))
      .sort((left, right) => left.label.localeCompare(right.label))
      .slice(0, 8)
      .map((entry) => entry.item);
  }

  return items
    .map((item) => {
      const label = getLabel(item);
      const normalizedLabel = normalizeSearchText(label);
      let rank = -1;

      if (normalizedLabel === normalizedQuery) {
        rank = 0;
      } else if (normalizedLabel.startsWith(normalizedQuery)) {
        rank = 1;
      } else if (normalizedLabel.includes(normalizedQuery)) {
        rank = 2;
      }

      return {
        item,
        label,
        rank,
        length: label.length,
      };
    })
    .filter((entry) => entry.rank >= 0)
    .sort((left, right) => left.rank - right.rank || left.length - right.length || left.label.localeCompare(right.label))
    .slice(0, 8)
    .map((entry) => entry.item);
}

function createAutocompleteController({ input, list, getItems, getLabel, onSelect, onClose, onTab, onEnterNoMatch, onStateChange }) {
  const state = {
    matches: [],
    activeIndex: -1,
  };

  function emitState() {
    if (onStateChange) {
      onStateChange({
        matches: state.matches,
        activeIndex: state.activeIndex,
      });
    }
  }

  function close() {
    state.matches = [];
    state.activeIndex = -1;
    list.hidden = true;
    list.innerHTML = "";
    emitState();
    if (onClose) {
      onClose();
    }
  }

  function selectMatch(match) {
    input.value = getLabel(match);
    close();
    onSelect(match);
  }

  function render() {
    if (!state.matches.length) {
      close();
      return;
    }

    list.hidden = false;
    list.innerHTML = "";
    state.matches.forEach((match, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `autocomplete-option${index === state.activeIndex ? " active" : ""}`;
      option.textContent = getLabel(match);
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectMatch(match);
      });
      list.append(option);
    });
  }

  function updateMatches() {
    state.matches = rankAutocompleteMatches(getItems(), input.value, getLabel);
    state.activeIndex = state.matches.length ? 0 : -1;
    emitState();
    render();
  }

  input.addEventListener("input", updateMatches);
  input.addEventListener("focus", updateMatches);
  input.addEventListener("blur", () => {
    window.setTimeout(close, 120);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Tab") {
      if (onTab) {
        onTab();
      }
      close();
      return;
    }

    if (event.key === "Enter") {
      if (state.matches.length) {
        event.preventDefault();
        const selected = state.matches[state.activeIndex];
        if (selected) {
          selectMatch(selected);
        }
      } else if (onEnterNoMatch) {
        event.preventDefault();
        onEnterNoMatch();
        close();
      }
      return;
    }

    if (!state.matches.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.activeIndex = Math.min(state.activeIndex + 1, state.matches.length - 1);
      emitState();
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.activeIndex = Math.max(state.activeIndex - 1, 0);
      emitState();
      render();
    }
  });

  return {
    close,
    updateMatches,
  };
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

function syncBaseIngredientGroupRows() {
  if (!elements.ingredientRows) {
    return;
  }

  const name = ingredientGroupNameForRecipe(elements.recipeName?.value.trim() || "");
  elements.ingredientRows
    .querySelectorAll('.component-row[data-component-type="ingredient_group"][data-base-ingredient-group="true"]')
    .forEach((row) => {
      const componentName = row.querySelector(".component-name");
      const recipeName = row.querySelector(".component-recipe-name");
      if (componentName) {
        componentName.value = name;
      }
      if (recipeName) {
        recipeName.value = name;
      }
      syncComponentRowState(row);
    });
}

function markDirty() {
  state.isDirty = true;
  updateSaveButtonState();
}

function recognizeRecipeNameState() {
  syncBaseIngredientGroupRows();
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
    savedIngredientId: row.dataset.savedIngredientId || row.dataset.libraryIngredientId || null,
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
  setIngredientRowSavedIdentity(row, savedIngredient.id);
  updateIngredientLibraryState(row);
  renderSavedIngredientOptions(savedIngredient.id);
}

function renderSavedIngredientOptions(selectedId = "") {
  if (elements.savedIngredientNames) {
    elements.savedIngredientNames.innerHTML = "";
  }

  if (!elements.savedIngredientSelect) {
    state.savedIngredients.forEach((ingredient) => {
      if (elements.savedIngredientNames) {
        const nameOption = document.createElement("option");
        nameOption.value = ingredient.name;
        elements.savedIngredientNames.append(nameOption);
      }
    });
    return;
  }

  const pickerIsSelect = elements.savedIngredientSelect.tagName === "SELECT";

  if (pickerIsSelect) {
    elements.savedIngredientSelect.innerHTML = "";
  }

  if (!state.savedIngredients.length) {
    if (pickerIsSelect) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No saved ingredients";
      elements.savedIngredientSelect.append(option);
    } else {
      elements.savedIngredientSelect.value = "";
    }
    return;
  }

  if (pickerIsSelect) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose ingredient";
    elements.savedIngredientSelect.append(placeholder);
  }

  state.savedIngredients.forEach((ingredient) => {
    if (pickerIsSelect) {
      const option = document.createElement("option");
      option.value = ingredient.id;
      option.textContent = ingredient.name;
      elements.savedIngredientSelect.append(option);
    }

    if (elements.savedIngredientNames) {
      const nameOption = document.createElement("option");
      nameOption.value = ingredient.name;
      elements.savedIngredientNames.append(nameOption);
    }
  });

  if (pickerIsSelect) {
    elements.savedIngredientSelect.value = selectedId;
  } else {
    const selectedIngredient = state.savedIngredients.find((ingredient) => ingredient.id === selectedId);
    elements.savedIngredientSelect.value = selectedIngredient ? selectedIngredient.name : "";
  }
}

function addSelectedSavedIngredient() {
  const pickerValue = elements.savedIngredientSelect.value.trim();
  const ingredient =
    state.savedIngredients.find((item) => item.id === pickerValue) ||
    state.savedIngredients.find((item) => item.name.toLowerCase() === pickerValue.toLowerCase());

  if (!ingredient) {
    elements.savedIngredientSelect.focus();
    return;
  }

  addIngredientRow(savedIngredientToRecipeIngredient(ingredient), { expanded: false });
  elements.savedIngredientSelect.value = "";
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

  if (row.dataset.skipNameLookup === "true") {
    row.dataset.skipNameLookup = "false";
    row.dataset.lastIngredientName = currentName;
    setIngredientRowSavedIdentity(row, null);
    row.dataset.customCommitted = currentName ? "true" : "false";
    updateIngredientGhostSuggestion(row);
    updateIngredientLibraryState(row);
    renderOutputs();
    return;
  }

  if (currentName.toLowerCase() === lastName.toLowerCase()) {
    return;
  }

  const savedIngredient = findSavedIngredientByName(nameInput.value);

  if (savedIngredient) {
    nameInput.value = savedIngredient.name;
    applySavedNutritionToRow(row, savedIngredient);
    setIngredientRowSavedIdentity(row, savedIngredient.id);
    row.dataset.customCommitted = "false";
  } else {
    suggestRowConversion(row);
    setIngredientRowSavedIdentity(row, null);
    row.dataset.customCommitted = "false";
  }

  row.dataset.lastIngredientName = nameInput.value.trim();
  updateIngredientGhostSuggestion(row);
  updateIngredientLibraryState(row);
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

function commitCustomIngredientRow(row, options = {}) {
  const name = row.querySelector(".ingredient-name").value.trim();
  row.dataset.skipNameLookup = "true";
  setIngredientRowSavedIdentity(row, null);
  row.dataset.customCommitted = name ? "true" : "false";
  row.dataset.lastIngredientName = name;
  updateIngredientGhostSuggestion(row);
  updateIngredientLibraryState(row);

  if (options.focusAmount) {
    row.querySelector(".ingredient-quantity").focus();
  }
}

function updateIngredientGhostSuggestion(row, suggestionText = "") {
  const ghost = row.querySelector(".ingredient-ghost-suggestion");
  const input = row.querySelector(".ingredient-name");
  if (!ghost || !input) {
    return;
  }

  const typed = input.value.trim();
  const suggestion = suggestionText.trim();

  if (!typed || !suggestion || normalizeSearchText(typed) === normalizeSearchText(suggestion)) {
    ghost.hidden = true;
    ghost.textContent = "";
    return;
  }

  ghost.hidden = false;
  ghost.textContent = suggestion;
}

function updateIngredientLibraryState(row) {
  const stateLabel = row.querySelector(".ingredient-library-state");
  if (!stateLabel) {
    return;
  }

  const componentType = row.dataset.componentType || "ingredient";
  if (componentType !== "ingredient") {
    stateLabel.hidden = true;
    return;
  }

  const name = row.querySelector(".ingredient-name").value.trim();
  const isLibraryIngredient = Boolean(row.dataset.savedIngredientId || row.dataset.libraryIngredientId);
  const customCommitted = row.dataset.customCommitted === "true";

  stateLabel.hidden = !name || isLibraryIngredient || !customCommitted;
}

function setIngredientRowSavedIdentity(row, savedIngredientId) {
  const value = savedIngredientId || "";
  row.dataset.savedIngredientId = value;
  row.dataset.libraryIngredientId = value;
  row.dataset.isLibraryIngredient = savedIngredientId ? "true" : "false";
}

function populateIngredientRowFromSaved(row, ingredient) {
  const nameInput = row.querySelector(".ingredient-name");
  nameInput.value = ingredient.name;
  applySavedNutritionToRow(row, ingredient);
  row.dataset.lastIngredientName = ingredient.name;
  setIngredientRowSavedIdentity(row, ingredient.id);
  row.dataset.customCommitted = "false";
  setIngredientRowExpanded(row, false);
  updateIngredientRowSummary(row);
  updateIngredientGhostSuggestion(row);
  updateIngredientLibraryState(row);
  markDirty();
  renderOutputs();
}

function attachIngredientAutocomplete(row) {
  const input = row.querySelector(".ingredient-name");
  const list = row.querySelector(".autocomplete-list");

  if (!input || !list) {
    return;
  }

  createAutocompleteController({
    input,
    list,
    getItems: () => state.savedIngredients,
    getLabel: (ingredient) => ingredient.name,
    onSelect: (ingredient) => {
      populateIngredientRowFromSaved(row, ingredient);
      row.querySelector(".ingredient-quantity").focus();
    },
    onTab: () => {
      commitCustomIngredientRow(row);
    },
    onEnterNoMatch: () => {
      commitCustomIngredientRow(row, { focusAmount: true });
    },
    onStateChange: ({ matches, activeIndex }) => {
      const activeMatch = matches[activeIndex];
      updateIngredientGhostSuggestion(row, activeMatch ? activeMatch.name : "");
    },
  });
}

function updateSubRecipeSelectionState() {
  if (!elements.subRecipeLookup || !elements.confirmSubRecipeButton) {
    return;
  }

  const exactMatch = state.recipes.find(
    (recipe) => normalizeSearchText(recipe.name) === normalizeSearchText(elements.subRecipeLookup.value),
  );

  elements.subRecipeLookup.dataset.selectedId = exactMatch ? exactMatch.id : "";
  elements.confirmSubRecipeButton.disabled = !exactMatch;
}

function attachSubRecipeAutocomplete() {
  if (!elements.subRecipeLookup || !elements.subRecipeSuggestions) {
    return;
  }

  createAutocompleteController({
    input: elements.subRecipeLookup,
    list: elements.subRecipeSuggestions,
    getItems: () => state.recipes,
    getLabel: (recipe) => recipe.name || "Untitled recipe",
    onSelect: (recipe) => {
      elements.subRecipeLookup.dataset.selectedId = recipe.id;
      elements.confirmSubRecipeButton.disabled = false;
      addSelectedSubRecipe();
    },
    onClose: updateSubRecipeSelectionState,
  });

  elements.subRecipeLookup.addEventListener("input", () => {
    updateSubRecipeSelectionState();
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

function updateIngredientDataStatus(row) {
  const status = row.querySelector(".ingredient-data-status");
  if (!status) {
    return;
  }

  const priceMissing = row.querySelector(".ingredient-price").value.trim() === "";
  const nutritionMissing = [
    ".ingredient-calories",
    ".ingredient-protein",
    ".ingredient-carbs",
    ".ingredient-fat",
  ].every((selector) => row.querySelector(selector).value.trim() === "");

  if (priceMissing && nutritionMissing) {
    status.textContent = "Cost and nutrition can be added later.";
  } else if (priceMissing) {
    status.textContent = "Cost can be added later.";
  } else if (nutritionMissing) {
    status.textContent = "Nutrition can be added later.";
  } else {
    status.textContent = "Cost and nutrition details are filled in.";
  }
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
  updateIngredientDataStatus(row);
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

function addIngredientRowToContainer(container, ingredient = emptyIngredient(), options = {}) {
  const fragment = elements.ingredientRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".ingredient-row");
  const normalizedIngredient = normalizeIngredient(ingredient);
  const handleChange = () => {
    if (typeof options.onChange === "function") {
      options.onChange();
      return;
    }

    markDirty();
    renderOutputs();
  };

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
  setIngredientRowSavedIdentity(row, normalizedIngredient.savedIngredientId);
  row.dataset.customCommitted = normalizedIngredient.savedIngredientId ? "false" : normalizedIngredient.name ? "true" : "false";
  attachIngredientAutocomplete(row);

  row.querySelector(".ingredient-name").addEventListener("input", () => {
    setIngredientRowSavedIdentity(row, null);
    row.dataset.customCommitted = "false";
    updateIngredientLibraryState(row);
  });

  row.querySelector(".ingredient-name").addEventListener("change", () => {
    applyIngredientNameUpdate(row);
    handleChange();
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
    handleChange();
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
    handleChange();
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      updateIngredientRowSummary(row);
      updateIngredientDataStatus(row);
      handleChange();
    });
  });

  container.append(row);
  syncRowConversionState(row);
  updateIngredientGhostSuggestion(row);
  updateIngredientLibraryState(row);
  setIngredientRowExpanded(row, Boolean(options.expanded));
  if (options.focusName) {
    row.querySelector(".ingredient-name").focus();
  }

  return row;
}

function addIngredientRow(ingredient = emptyIngredient(), options = {}) {
  return addIngredientRowToContainer(options.container || elements.ingredientRows, ingredient, options);
}

function setComponentUnitOptions(select, type) {
  if (type === "ingredient") {
    setUnitOptions(select);
    return;
  }

  if (type === "ingredient_group") {
    select.innerHTML = "";
    return;
  }

  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "serving";
  option.textContent = "servings";
  select.append(option);
}

function syncComponentRowState(row) {
  const type = row.dataset.componentType || "ingredient";
  const nameInput = row.querySelector(".component-name");
  const quantityInput = row.querySelector(".component-quantity");
  const unitInput = row.querySelector(".component-unit");
  const note = row.querySelector(".component-amount-note");
  const cost = row.querySelector(".component-cost");
  const typePill = row.querySelector(".component-type-pill");
  const ingredientDetails = row.querySelector(".component-ingredient-details");
  const recipeDetails = row.querySelector(".component-recipe-details");
  const recipeDetailTitle = recipeDetails.querySelector(".component-detail-header h4");
  const recipeDetailText = recipeDetails.querySelector(".component-detail-header .muted");
  const recipeMeta = row.querySelector(".component-recipe-meta");
  const removeButton = row.querySelector(".remove-component");
  const nestedAddButton = row.querySelector(".nested-add-ingredient");
  const previousUnit = unitInput.value || "g";

  typePill.textContent = componentTypeLabel(type);
  nameInput.readOnly = type === "ingredient_group";
  setComponentUnitOptions(unitInput, type);
  if (type === "ingredient") {
    unitInput.value = UNIT_OPTIONS.some((option) => option.value === previousUnit) ? previousUnit : "g";
  }
  unitInput.disabled = type !== "ingredient";

  if (type === "ingredient") {
    ingredientDetails.hidden = false;
    recipeDetails.hidden = true;
    recipeMeta.hidden = true;
    quantityInput.hidden = false;
    unitInput.hidden = false;
    removeButton.hidden = false;
    const ingredient = ingredientFromRow(row);
    note.textContent = ingredient.amount ? `${formatGrams(ingredient.amount)} total` : "0 g total";
    row.dataset.currentUnit = unitInput.value;
    cost.textContent = ingredient.price === null || !ingredient.amount ? "-" : formatCurrency(costForIngredient(ingredient));
    updateIngredientDataStatus(row);
  } else if (type === "ingredient_group") {
    ingredientDetails.hidden = true;
    recipeDetails.hidden = false;
    recipeDetailTitle.textContent = "Ingredient group";
    recipeDetailText.textContent = "These are the original ingredients from the loaded recipe.";
    recipeMeta.hidden = true;
    quantityInput.hidden = true;
    unitInput.hidden = true;
    removeButton.hidden = true;
    nestedAddButton.hidden = false;
    const component = componentFromRow(row);
    const totals = componentContributionTotals(component);
    note.textContent = totals.weight > 0 ? `${formatGrams(totals.weight)} total` : "0 g total";
    cost.textContent = totals.price > 0 ? formatCurrency(totals.price) : "-";
  } else {
    ingredientDetails.hidden = true;
    recipeDetails.hidden = false;
    recipeDetailTitle.textContent = "Recipe details";
    recipeDetailText.textContent = "Use servings and nested ingredients to define this recipe.";
    recipeMeta.hidden = false;
    quantityInput.hidden = false;
    unitInput.hidden = false;
    removeButton.hidden = false;
    nestedAddButton.hidden = false;
    const component = componentFromRow(row);
    const quantity = Math.max(Number(component.quantity) || 0, 0);
    note.textContent = `${formatNumber(quantity)} ${Math.abs(quantity - 1) < 0.005 ? "serving" : "servings"} used`;
    const totals = componentContributionTotals(component);
    cost.textContent = totals.price > 0 ? formatCurrency(totals.price) : "-";
  }

  updateIngredientLibraryState(row);
}

function componentRecipeDataFromRow(row) {
  const nestedRows = row.querySelector(".nested-ingredient-rows");
  return normalizeNestedRecipeData({
    name: row.querySelector(".component-recipe-name").value.trim() || row.querySelector(".component-name").value.trim(),
    servings: Math.max(numberFromInput(row.querySelector(".component-recipe-servings")), 1),
    ingredients: [...nestedRows.querySelectorAll(".ingredient-row")].map(ingredientFromRow),
  });
}

function componentFromRow(row) {
  const type = row.dataset.componentType || "ingredient";

  if (type === "ingredient") {
    return normalizeComponent({
      ...ingredientFromRow(row),
      id: row.dataset.componentId || createId(),
      type: "ingredient",
    });
  }

  const recipeData = componentRecipeDataFromRow(row);
  return normalizeComponent({
    id: row.dataset.componentId || createId(),
    type,
    name: row.querySelector(".component-name").value.trim() || recipeData.name || "Untitled recipe",
    sourceRecipeId: type === "recipe" ? row.dataset.sourceRecipeId || null : null,
    quantity: type === "ingredient_group" ? 1 : Math.max(numberFromInput(row.querySelector(".component-quantity")), 0.01),
    unit: type === "ingredient_group" ? "group" : "serving",
    baseIngredientGroup: row.dataset.baseIngredientGroup === "true",
    recipeData,
  });
}

function populateNestedRecipeIngredients(row, recipeData) {
  const nestedRows = row.querySelector(".nested-ingredient-rows");
  nestedRows.innerHTML = "";
  const ingredients = recipeData.ingredients.length ? recipeData.ingredients : [];
  ingredients.forEach((ingredient) => {
    addIngredientRowToContainer(nestedRows, ingredient, {
      onChange: () => {
        markDirty();
        syncComponentRowState(row);
        renderOutputs();
      },
    });
  });
}

function setComponentRowType(row, type, options = {}) {
  row.dataset.componentType = type;
  row.dataset.expanded = options.expanded ? "true" : row.dataset.expanded || "false";
  if (options.baseIngredientGroup !== undefined) {
    row.dataset.baseIngredientGroup = options.baseIngredientGroup ? "true" : "false";
  } else {
    row.dataset.baseIngredientGroup = row.dataset.baseIngredientGroup || "false";
  }

  if (type === "ingredient") {
    row.dataset.sourceRecipeId = "";
    row.dataset.customCommitted = options.customCommitted ? "true" : row.dataset.customCommitted || "false";
  } else {
    row.dataset.savedIngredientId = "";
    row.dataset.libraryIngredientId = "";
    row.dataset.isLibraryIngredient = "false";
    row.dataset.customCommitted = "false";
  }

  setIngredientRowExpanded(row, options.expanded ?? row.dataset.expanded === "true");
  syncComponentRowState(row);
}

function populateComponentFromSavedIngredient(row, ingredient) {
  row.dataset.componentId = row.dataset.componentId || createId();
  row.dataset.sourceRecipeId = "";
  row.querySelector(".component-name").value = ingredient.name;
  applySavedNutritionToRow(row, ingredient);
  row.dataset.lastIngredientName = ingredient.name;
  setIngredientRowSavedIdentity(row, ingredient.id);
  row.dataset.customCommitted = "false";
  setComponentRowType(row, "ingredient", { expanded: false });
  markDirty();
  renderOutputs();
  row.querySelector(".component-quantity").focus();
}

function populateComponentFromSavedRecipe(row, recipe) {
  const component = savedRecipeToComponent(recipe);
  row.dataset.componentId = component.id;
  row.dataset.sourceRecipeId = component.sourceRecipeId || "";
  row.dataset.baseIngredientGroup = "false";
  row.querySelector(".component-name").value = component.name;
  row.querySelector(".component-quantity").value = formatInputNumber(component.quantity);
  row.querySelector(".component-recipe-name").value = component.recipeData.name || component.name;
  row.querySelector(".component-recipe-servings").value = formatWholeInputNumber(component.recipeData.servings);
  populateNestedRecipeIngredients(row, component.recipeData);
  setComponentRowType(row, "recipe", { expanded: false });
  markDirty();
  renderOutputs();
  row.querySelector(".component-quantity").focus();
}

function commitComponentAsCustomIngredient(row, options = {}) {
  const name = row.querySelector(".component-name").value.trim();
  row.dataset.componentId = row.dataset.componentId || createId();
  row.dataset.sourceRecipeId = "";
  row.dataset.baseIngredientGroup = "false";
  setIngredientRowSavedIdentity(row, null);
  row.dataset.customCommitted = name ? "true" : "false";
  row.dataset.lastIngredientName = name;
  suggestRowConversion(row);
  setComponentRowType(row, "ingredient", {
    expanded: options.expanded === undefined ? true : Boolean(options.expanded),
    customCommitted: true,
  });
  if (options.focusAmount) {
    row.querySelector(".component-quantity").focus();
  }
  markDirty();
  renderOutputs();
}

function commitComponentAsDraftRecipe(row, options = {}) {
  const name = row.querySelector(".component-name").value.trim();
  const nestedRows = row.querySelector(".nested-ingredient-rows");
  row.dataset.componentId = row.dataset.componentId || createId();
  row.dataset.sourceRecipeId = "";
  row.dataset.baseIngredientGroup = "false";
  row.querySelector(".component-recipe-name").value = name;
  if (!nestedRows.children.length) {
    addIngredientRowToContainer(nestedRows, emptyIngredient(), {
      expanded: false,
      focusName: true,
      onChange: () => {
        markDirty();
        syncComponentRowState(row);
        renderOutputs();
      },
    });
  }
  setComponentRowType(row, "draft_recipe", { expanded: true });
  if (!options.focusNested) {
    row.querySelector(".component-quantity").focus();
  }
  markDirty();
  renderOutputs();
}

function buildComponentSuggestionItems(query) {
  const items = [];
  const trimmed = query.trim();
  const savedRecipes = rankAutocompleteMatches(state.recipes, query, (recipe) => recipe.name || "Untitled recipe");
  const savedIngredients = rankAutocompleteMatches(state.savedIngredients, query, (ingredient) => ingredient.name);

  if (savedRecipes.length) {
    items.push({ kind: "header", label: "Recipes" });
    savedRecipes.forEach((recipe) => {
      items.push({
        kind: "saved_recipe",
        label: recipe.name || "Untitled recipe",
        value: recipe,
      });
    });
  }

  if (savedIngredients.length) {
    items.push({ kind: "header", label: "Ingredients" });
    savedIngredients.forEach((ingredient) => {
      items.push({
        kind: "saved_ingredient",
        label: ingredient.name,
        value: ingredient,
      });
    });
  }

  if (trimmed) {
    items.push({ kind: "header", label: "Create New" });
    items.push({
      kind: "create_ingredient",
      label: `Create "${trimmed}" as ingredient`,
      value: trimmed,
    });
    items.push({
      kind: "create_recipe",
      label: `Create "${trimmed}" as recipe`,
      value: trimmed,
    });
  }

  return items;
}

function attachComponentAutocomplete(row) {
  const input = row.querySelector(".component-name");
  const list = row.querySelector(".component-suggestions");
  const stateful = {
    items: [],
    activeIndex: -1,
  };

  function positionList() {
    if (!input || !list || list.hidden || !document.body.contains(input)) {
      return;
    }

    const rect = input.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(Math.min(openAbove ? spaceAbove : spaceBelow, 352), 120);

    list.style.width = `${Math.max(rect.width, 260)}px`;
    list.style.left = `${rect.left}px`;
    list.style.top = openAbove ? `${Math.max(rect.top - maxHeight - 6, 8)}px` : `${rect.bottom + 6}px`;
    list.style.maxHeight = `${maxHeight}px`;
  }

  function selectableIndices() {
    return stateful.items.reduce((indices, item, index) => {
      if (item.kind !== "header") {
        indices.push(index);
      }
      return indices;
    }, []);
  }

  function activeSavedSuggestion() {
    const activeItem = stateful.items[stateful.activeIndex];
    if (!activeItem || !["saved_recipe", "saved_ingredient"].includes(activeItem.kind)) {
      return "";
    }
    return activeItem.label;
  }

  function render() {
    if (!stateful.items.length) {
      list.hidden = true;
      list.innerHTML = "";
      list.style.width = "";
      list.style.left = "";
      list.style.top = "";
      list.style.maxHeight = "";
      updateIngredientGhostSuggestion(row);
      return;
    }

    if (list.parentElement !== document.body) {
      document.body.append(list);
    }
    list.hidden = false;
    list.innerHTML = "";
    stateful.items.forEach((item, index) => {
      if (item.kind === "header") {
        const header = document.createElement("div");
        header.className = "autocomplete-group";
        header.textContent = item.label;
        list.append(header);
        return;
      }

      const option = document.createElement("button");
      option.type = "button";
      option.className = `autocomplete-option${index === stateful.activeIndex ? " active" : ""}`;
      option.textContent = item.label;
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectItem(item);
      });
      list.append(option);
    });

    positionList();
    updateIngredientGhostSuggestion(row, activeSavedSuggestion());
  }

  function close() {
    stateful.items = [];
    stateful.activeIndex = -1;
    list.hidden = true;
    list.innerHTML = "";
    list.style.width = "";
    list.style.left = "";
    list.style.top = "";
    list.style.maxHeight = "";
    updateIngredientGhostSuggestion(row);
  }

  function updateItems() {
    stateful.items = buildComponentSuggestionItems(input.value);
    const indices = selectableIndices();
    stateful.activeIndex = indices.length ? indices[0] : -1;
    render();
  }

  function selectItem(item) {
    if (!item || item.kind === "header") {
      return;
    }

    if (item.kind === "saved_ingredient") {
      populateComponentFromSavedIngredient(row, item.value);
    } else if (item.kind === "saved_recipe") {
      populateComponentFromSavedRecipe(row, item.value);
    } else if (item.kind === "create_recipe") {
      input.value = item.value;
      commitComponentAsDraftRecipe(row, { focusNested: true });
    } else {
      input.value = item.value;
      commitComponentAsCustomIngredient(row, { focusAmount: true });
    }

    close();
  }

  input.addEventListener("input", () => {
    row.dataset.sourceRecipeId = "";
    setIngredientRowSavedIdentity(row, null);
    row.dataset.customCommitted = "false";
    updateIngredientLibraryState(row);
    updateItems();
  });

  input.addEventListener("focus", updateItems);
  input.addEventListener("blur", () => {
    window.setTimeout(close, 120);
  });
  window.addEventListener("resize", positionList);
  window.addEventListener("scroll", positionList, true);
  input.addEventListener("keydown", (event) => {
    const indices = selectableIndices();

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Tab") {
      commitComponentAsCustomIngredient(row, { focusAmount: true });
      close();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (stateful.activeIndex >= 0) {
        selectItem(stateful.items[stateful.activeIndex]);
      } else {
        commitComponentAsCustomIngredient(row, { focusAmount: true });
        close();
      }
      return;
    }

    if (!indices.length) {
      return;
    }

    const currentSelectable = Math.max(indices.indexOf(stateful.activeIndex), 0);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      stateful.activeIndex = indices[Math.min(currentSelectable + 1, indices.length - 1)];
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      stateful.activeIndex = indices[Math.max(currentSelectable - 1, 0)];
      render();
    }
  });
}

function addComponentRow(component = emptyComponent(), options = {}) {
  const fragment = elements.componentRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".component-row");
  const normalizedComponent = normalizeComponent(component);
  const nestedRows = row.querySelector(".nested-ingredient-rows");

  row.dataset.componentId = normalizedComponent.id || createId();
  row.dataset.baseIngredientGroup = normalizedComponent.baseIngredientGroup ? "true" : "false";
  attachComponentAutocomplete(row);

  row.querySelector(".component-name").value = normalizedComponent.name || "";
  row.querySelector(".component-quantity").value = normalizedComponent.quantity ? formatInputNumber(normalizedComponent.quantity) : "";
  row.querySelector(".component-recipe-name").value = normalizedComponent.type === "ingredient"
    ? normalizedComponent.name || ""
    : normalizedComponent.recipeData.name || normalizedComponent.name || "";
  row.querySelector(".component-recipe-servings").value = normalizedComponent.type === "ingredient"
    ? "1"
    : formatWholeInputNumber(normalizedComponent.recipeData.servings);

  row.querySelector(".expand-component").addEventListener("click", () => {
    setIngredientRowExpanded(row, row.dataset.expanded !== "true");
  });

  row.querySelector(".remove-component").addEventListener("click", () => {
    delete state.batchBreakdownExpanded[row.dataset.componentId || ""];
    row.remove();
    markDirty();
    renderOutputs();
  });

  row.querySelector(".component-name").addEventListener("change", () => {
    const type = row.dataset.componentType || "ingredient";
    if (type === "ingredient") {
      applyIngredientNameUpdate(row);
    } else {
      row.querySelector(".component-recipe-name").value = row.querySelector(".component-name").value.trim();
      syncComponentRowState(row);
    }
    markDirty();
    renderOutputs();
  });

  row.querySelector(".component-quantity").addEventListener("input", () => {
    syncComponentRowState(row);
    markDirty();
    renderOutputs();
  });

  row.querySelector(".component-unit").addEventListener("change", () => {
    if ((row.dataset.componentType || "ingredient") !== "ingredient") {
      return;
    }

    const previousGrams = gramsBeforeUnitChange(row, row.querySelector(".component-unit").value);
    const conversion = conversionForIngredient(row.querySelector(".component-name").value, row.querySelector(".component-unit").value);
    row.querySelector(".component-grams-per-unit").value = formatPreciseInputNumber(conversion.gramsPerUnit);
    if (Number.isFinite(previousGrams) && previousGrams > 0) {
      row.querySelector(".component-quantity").value = formatPreciseInputNumber(
        displayQuantityFromGrams(previousGrams, row.querySelector(".component-unit").value, conversion.gramsPerUnit),
      );
    }
    syncComponentRowState(row);
    markDirty();
    renderOutputs();
  });

  [
    ".component-grams-per-unit",
    ".component-price",
    ".component-calories",
    ".component-protein",
    ".component-carbs",
    ".component-fat",
  ].forEach((selector) => {
    row.querySelector(selector).addEventListener("input", () => {
      syncComponentRowState(row);
      markDirty();
      renderOutputs();
    });
  });

  row.querySelector(".save-component-ingredient").addEventListener("click", () => {
    saveIngredientFromRow(row);
    syncComponentRowState(row);
    markDirty();
    renderOutputs();
  });

  row.querySelector(".component-recipe-name").addEventListener("input", () => {
    row.querySelector(".component-name").value = row.querySelector(".component-recipe-name").value.trim();
    syncComponentRowState(row);
    markDirty();
    renderOutputs();
  });

  row.querySelector(".component-recipe-servings").addEventListener("input", () => {
    syncComponentRowState(row);
    markDirty();
    renderOutputs();
  });

  row.querySelector(".nested-add-ingredient").addEventListener("click", () => {
    addIngredientRowToContainer(nestedRows, emptyIngredient(), {
      focusName: true,
      onChange: () => {
        markDirty();
        syncComponentRowState(row);
        renderOutputs();
      },
    });
    setIngredientRowExpanded(row, true);
  });

  if (normalizedComponent.type !== "ingredient") {
    row.dataset.sourceRecipeId = normalizedComponent.sourceRecipeId || "";
    populateNestedRecipeIngredients(row, normalizedComponent.recipeData);
  } else {
    setUnitOptions(row.querySelector(".component-unit"));
    row.querySelector(".component-unit").value = normalizedComponent.unit || "g";
    row.querySelector(".component-grams-per-unit").value = formatPreciseInputNumber(normalizedComponent.gramsPerUnit || 1);
    row.querySelector(".component-price").value = normalizedComponent.price === null ? "" : normalizedComponent.price || "";
    row.querySelector(".component-calories").value = normalizedComponent.calories || "";
    row.querySelector(".component-protein").value = normalizedComponent.protein || "";
    row.querySelector(".component-carbs").value = normalizedComponent.carbs || "";
    row.querySelector(".component-fat").value = normalizedComponent.fat || "";
    row.dataset.lastIngredientName = normalizedComponent.name || "";
    setIngredientRowSavedIdentity(row, normalizedComponent.savedIngredientId);
    row.dataset.customCommitted = normalizedComponent.savedIngredientId ? "false" : normalizedComponent.name ? "true" : "false";
  }

  elements.ingredientRows.append(row);
  setComponentRowType(row, normalizedComponent.type, {
    expanded: Boolean(options.expanded),
    customCommitted: !normalizedComponent.savedIngredientId && normalizedComponent.type === "ingredient" && Boolean(normalizedComponent.name),
    baseIngredientGroup: normalizedComponent.baseIngredientGroup ? "true" : "false",
  });

  if (options.focusName) {
    row.querySelector(".component-name").focus();
  }

  return row;
}

function setFormRecipe(recipe, options = {}) {
  let hydratedRecipe = repairRecipeSavedIngredientLinks(recipe);
  const saved = options.saved !== false;
  if (saved && isMakeWorkspace()) {
    hydratedRecipe = withBaseIngredientGroup(hydratedRecipe);
  }
  state.selectedId = saved ? hydratedRecipe.id : null;
  state.draftId = saved ? null : hydratedRecipe.id;
  state.isDirty = false;
  elements.recipeName.value = hydratedRecipe.name;
  elements.recipeServings.value = hydratedRecipe.servings;
  elements.ingredientRows.innerHTML = "";

  if (saved) {
    const recipeIndex = state.recipes.findIndex((item) => item.id === hydratedRecipe.id);
    if (recipeIndex >= 0) {
      const changed = JSON.stringify(state.recipes[recipeIndex]) !== JSON.stringify(hydratedRecipe);
      state.recipes[recipeIndex] = hydratedRecipe;
      if (changed) {
        saveRecipes();
      }
    }
  }

  const components = hydratedRecipe.components.length || isMakeWorkspace() ? hydratedRecipe.components : [emptyComponent()];
  components.forEach(addComponentRow);

  applySavedScaleControls(hydratedRecipe);
  if (elements.sellingPriceInput) {
    elements.sellingPriceInput.value = "";
  }
  renderAll();
  updateSaveButtonState();
}

function newRecipe() {
  const recipe = {
    id: createId(),
    name: "",
    servings: isMakeWorkspace() ? 1 : 4,
    components: isMakeWorkspace() ? [] : [emptyComponent()],
    ingredients: [],
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

function scaledTotals(source, multiplier = 1) {
  return {
    weight: source.weight * multiplier,
    price: source.price * multiplier,
    calories: source.calories * multiplier,
    protein: source.protein * multiplier,
    carbs: source.carbs * multiplier,
    fat: source.fat * multiplier,
  };
}

function componentContributionTotals(component) {
  const normalizedComponent = normalizeComponent(component);

  if (normalizedComponent.type === "ingredient") {
    const amountRatio = normalizedComponent.amount / 100;
    return {
      weight: normalizedComponent.amount,
      price: normalizedComponent.price === null ? 0 : normalizedComponent.price * amountRatio,
      calories: normalizedComponent.calories * amountRatio,
      protein: normalizedComponent.protein * amountRatio,
      carbs: normalizedComponent.carbs * amountRatio,
      fat: normalizedComponent.fat * amountRatio,
    };
  }

  if (normalizedComponent.type === "ingredient_group") {
    return totalsForRecipe({
      name: normalizedComponent.recipeData.name,
      servings: normalizedComponent.recipeData.servings,
      ingredients: normalizedComponent.recipeData.ingredients,
    }).recipe;
  }

  const recipeData = normalizeNestedRecipeData(normalizedComponent.recipeData);
  const recipeTotals = totalsForRecipe({
    name: recipeData.name,
    servings: recipeData.servings,
    ingredients: recipeData.ingredients,
  }).recipe;
  const servingsUsed = Math.max(Number(normalizedComponent.quantity) || 0, 0);
  const factor = servingsUsed / Math.max(Number(recipeData.servings) || 1, 0.01);
  return scaledTotals(recipeTotals, factor);
}

function scaledIngredientEntriesForRecipe(recipe, factor = 1, prefix = "") {
  return recipeComponents(recipe).flatMap((component) => {
    const normalizedComponent = normalizeComponent(component);

    if (normalizedComponent.type === "ingredient") {
      return [
        {
          name: prefix ? `${prefix} / ${normalizedComponent.name || "Unnamed ingredient"}` : normalizedComponent.name || "Unnamed ingredient",
          ingredient: normalizedIngredientForComponent(normalizedComponent),
          grams: normalizedComponent.amount * factor,
        },
      ];
    }

    const recipeData = normalizeNestedRecipeData(normalizedComponent.recipeData);
    const nestedFactor =
      factor * (Math.max(Number(normalizedComponent.quantity) || 0, 0) / Math.max(Number(recipeData.servings) || 1, 0.01));
    const nestedPrefix = prefix
      ? `${prefix} / ${normalizedComponent.name || "Untitled recipe"}`
      : normalizedComponent.name || "Untitled recipe";

    return recipeData.ingredients.map((ingredient) => ({
      name: `${nestedPrefix} / ${ingredient.name || "Unnamed ingredient"}`,
      ingredient: normalizeIngredient(ingredient),
      grams: normalizeIngredient(ingredient).amount * nestedFactor,
    }));
  });
}

function normalizedIngredientForComponent(component) {
  return normalizeIngredient(component);
}

function batchBreakdownEntryForComponent(component, factor) {
  const normalizedComponent = normalizeComponent(component);
  const componentId = normalizedComponent.id || createId();

  if (normalizedComponent.type === "ingredient") {
    return {
      id: componentId,
      type: normalizedComponent.type,
      label: normalizedComponent.name || "Unnamed ingredient",
      amountText: formatIngredientAmount(normalizedIngredientForComponent(normalizedComponent), normalizedComponent.amount * factor),
      expanded: false,
      children: [],
    };
  }

  if (normalizedComponent.type === "ingredient_group") {
    const recipeData = normalizeNestedRecipeData(normalizedComponent.recipeData);
    const totals = componentContributionTotals(normalizedComponent);
    const children = recipeData.ingredients.map((ingredient, index) => {
      const normalizedIngredient = normalizeIngredient(ingredient);
      return {
        id: `${componentId}-ingredient-${index}`,
        label: normalizedIngredient.name || "Unnamed ingredient",
        amountText: formatIngredientAmount(normalizedIngredient, normalizedIngredient.amount * factor),
      };
    });

    return {
      id: componentId,
      type: normalizedComponent.type,
      label: normalizedComponent.name || "Ingredients",
      amountText: totals.weight > 0 ? formatGrams(totals.weight * factor) : "-",
      expanded: Boolean(state.batchBreakdownExpanded[componentId]),
      children,
    };
  }

  const recipeData = normalizeNestedRecipeData(normalizedComponent.recipeData);
  const servingFactor = Math.max(Number(normalizedComponent.quantity) || 0, 0) / Math.max(Number(recipeData.servings) || 1, 0.01);
  const scaledServingsUsed = (Number(normalizedComponent.quantity) || 0) * factor;
  const children = recipeData.ingredients.map((ingredient, index) => {
    const normalizedIngredient = normalizeIngredient(ingredient);
    return {
      id: `${componentId}-ingredient-${index}`,
      label: normalizedIngredient.name || "Unnamed ingredient",
      amountText: formatIngredientAmount(normalizedIngredient, normalizedIngredient.amount * factor * servingFactor),
    };
  });

  return {
    id: componentId,
    type: normalizedComponent.type,
    label: normalizedComponent.name || "Untitled recipe",
    amountText: `${formatNumber(scaledServingsUsed)} ${Math.abs(scaledServingsUsed - 1) < 0.005 ? "serving" : "servings"} used`,
    expanded: Boolean(state.batchBreakdownExpanded[componentId]),
    children,
  };
}

function renderBatchBreakdownRow(entry) {
  const row = document.createElement("tr");
  row.className = "batch-component-row";

  const nameCell = document.createElement("td");
  const amountCell = document.createElement("td");
  const nameWrap = document.createElement("div");
  nameWrap.className = "batch-component-cell";

  if (entry.type === "recipe" || entry.type === "draft_recipe" || entry.type === "ingredient_group") {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "batch-component-toggle";
    toggle.textContent = entry.expanded ? "-" : "+";
    toggle.setAttribute("aria-label", entry.expanded ? `Collapse ${entry.label}` : `Expand ${entry.label}`);
    toggle.addEventListener("click", () => {
      state.batchBreakdownExpanded[entry.id] = !state.batchBreakdownExpanded[entry.id];
      renderOutputs();
    });
    nameWrap.append(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "batch-component-spacer";
    spacer.setAttribute("aria-hidden", "true");
    nameWrap.append(spacer);
  }

  const labelGroup = document.createElement("div");
  labelGroup.className = "batch-component-text";
  const name = document.createElement("strong");
  name.textContent = entry.label;
  labelGroup.append(name);

  if (entry.type === "recipe" || entry.type === "draft_recipe" || entry.type === "ingredient_group") {
    const pill = document.createElement("span");
    pill.className = "component-type-pill batch-component-pill";
    pill.textContent = componentTypeLabel(entry.type);
    labelGroup.append(pill);
  }

  nameWrap.append(labelGroup);
  nameCell.append(nameWrap);
  amountCell.textContent = entry.amountText;
  row.append(nameCell, amountCell);

  const rows = [row];
  if (entry.expanded && entry.children.length) {
    entry.children.forEach((child) => {
      const childRow = document.createElement("tr");
      childRow.className = "batch-component-row batch-component-child-row";
      const childName = document.createElement("td");
      const childAmount = document.createElement("td");
      const childWrap = document.createElement("div");
      childWrap.className = "batch-component-cell batch-component-child-cell";

      const spacer = document.createElement("span");
      spacer.className = "batch-component-spacer";
      spacer.setAttribute("aria-hidden", "true");
      const childLabel = document.createElement("span");
      childLabel.textContent = child.label;

      childWrap.append(spacer, childLabel);
      childName.append(childWrap);
      childAmount.textContent = child.amountText;
      childRow.append(childName, childAmount);
      rows.push(childRow);
    });
  }

  return rows;
}

function openSubRecipeCreator() {
  if (!elements.subRecipeCreator || !elements.subRecipeLookup) {
    return;
  }

  elements.subRecipeCreator.hidden = false;
  elements.subRecipeLookup.value = "";
  elements.subRecipeLookup.dataset.selectedId = "";
  elements.confirmSubRecipeButton.disabled = true;
  elements.subRecipeLookup.focus();
}

function closeSubRecipeCreator() {
  if (!elements.subRecipeCreator || !elements.subRecipeLookup) {
    return;
  }

  elements.subRecipeCreator.hidden = true;
  elements.subRecipeLookup.value = "";
  elements.subRecipeLookup.dataset.selectedId = "";
  if (elements.subRecipeSuggestions) {
    elements.subRecipeSuggestions.hidden = true;
    elements.subRecipeSuggestions.innerHTML = "";
  }
  elements.confirmSubRecipeButton.disabled = true;
}

function addSelectedSubRecipe() {
  const selectedId = elements.subRecipeLookup?.dataset.selectedId || "";
  const recipe =
    state.recipes.find((item) => item.id === selectedId) ||
    state.recipes.find((item) => normalizeSearchText(item.name) === normalizeSearchText(elements.subRecipeLookup.value || ""));

  if (!recipe) {
    elements.subRecipeLookup.focus();
    return;
  }

  state.subRecipes.push({
    id: recipe.id,
    batches: 1,
  });
  closeSubRecipeCreator();
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
      createDetailItem("Components", formatNumber(recipeComponents(recipe).length, 0)),
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
  if (!elements.servingTotalsGrid || !elements.sellingTotalsGrid || !elements.batchTotalsGrid) {
    return;
  }

  const totals = totalsForRecipe(recipe);
  const hasComponents = recipeComponents(recipe).length > 0;
  const servingCost = hasComponents ? formatCurrency(totals.serving.price) : "-";
  const servingWeight = hasComponents ? formatGrams(totals.serving.weight) : "-";
  const servingCalories = hasComponents ? formatNumber(totals.serving.calories, 0) : "-";
  const servingProtein = hasComponents ? `${formatNumber(totals.serving.protein)} g` : "-";
  const servingCarbs = hasComponents ? `${formatNumber(totals.serving.carbs)} g` : "-";
  const servingFat = hasComponents ? `${formatNumber(totals.serving.fat)} g` : "-";
  const batchSize = targetServingsForRecipe(recipe);
  const batchFactor = batchSize / Math.max(Number(recipe.servings) || 1, 0.01);
  const sellingPrice = elements.sellingPriceInput ? Number.parseFloat(elements.sellingPriceInput.value) : NaN;
  const hasSellingPrice = Number.isFinite(sellingPrice) && sellingPrice >= 0;
  const batchCostValue = totals.recipe.price * batchFactor;
  const totalRevenueValue = hasSellingPrice ? sellingPrice * batchSize : NaN;
  const profitPerServingValue = hasSellingPrice ? sellingPrice - totals.serving.price : NaN;
  const totalProfitValue = hasSellingPrice ? totalRevenueValue - batchCostValue : NaN;
  const marginValue = hasSellingPrice && sellingPrice > 0 ? profitPerServingValue / sellingPrice : NaN;

  renderSummaryGroup(elements.servingTotalsGrid, [
    ["Cost per serving", servingCost],
    ["Calories per serving", servingCalories],
    ["Protein per serving", servingProtein],
    ["Carbs per serving", servingCarbs],
    ["Fat per serving", servingFat],
    ["Weight per serving", servingWeight],
  ]);

  renderSummaryGroup(elements.sellingTotalsGrid, [
    ["Profit per serving", hasSellingPrice ? formatCurrency(profitPerServingValue) : "-"],
    ["Margin", hasSellingPrice ? formatPercentage(marginValue) : "-"],
  ]);

  renderSummaryGroup(elements.batchTotalsGrid, [
    ["Total cost", hasComponents ? formatCurrency(batchCostValue) : "-"],
    ["Total revenue", hasSellingPrice ? formatCurrency(totalRevenueValue) : "-"],
    ["Total profit", hasSellingPrice ? formatCurrency(totalProfitValue) : "-"],
  ]);
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
  if (!container) {
    return;
  }

  container.innerHTML = "";
  items.forEach(([label, value]) => {
    container.append(createSummaryItem(label, value));
  });
}

function resetScaleControls(recipe) {
  const totals = totalsForRecipe(recipe);
  if (elements.targetServings) {
    elements.targetServings.value = formatWholeInputNumber(recipe.servings);
  }
  if (elements.targetServingGrams) {
    elements.targetServingGrams.value = totals.serving.weight ? formatInputNumber(totals.serving.weight) : "";
  }
  state.lastScaleInput = "servings";
  state.scaleFactor = 1;
}

function applySavedScaleControls(recipe) {
  if (!elements.targetServings || !elements.targetServingGrams) {
    return;
  }

  const totals = totalsForRecipe(recipe);
  if (!recipe.adjustment) {
    resetScaleControls(recipe);
    return;
  }

  elements.targetServings.value = formatWholeInputNumber(recipe.adjustment.targetServings);
  elements.targetServingGrams.value = totals.serving.weight ? formatInputNumber(totals.serving.weight) : "";
  state.lastScaleInput = "servings";
  state.scaleFactor = Math.max(Number(recipe.adjustment.targetServings) || Number(recipe.servings) || 1, 1) / Math.max(Number(recipe.servings) || 1, 0.01);
}

function targetServingsForRecipe(recipe) {
  if (!elements.targetServings) {
    return Math.max(Math.round(Number(recipe.servings) || 1), 1);
  }

  const fallback = Math.max(Math.round(Number(recipe.servings) || 1), 1);
  const parsed = Number.parseFloat(elements.targetServings.value);
  return Number.isFinite(parsed) ? Math.max(Math.round(parsed), 1) : fallback;
}

function scaleFactorForRecipe(recipe) {
  const targetServings = targetServingsForRecipe(recipe);
  return targetServings / Math.max(Number(recipe.servings) || 1, 0.01);
}

function syncScaleControls(recipe) {
  if (!elements.targetServings) {
    return;
  }

  const totals = totalsForRecipe(recipe);
  const targetServings = targetServingsForRecipe(recipe);

  if (elements.targetServings.value !== targetServings.toString()) {
    elements.targetServings.value = targetServings.toString();
  }

  if (elements.targetServingGrams) {
    elements.targetServingGrams.value = totals.serving.weight ? formatInputNumber(totals.serving.weight) : "";
  }

  state.scaleFactor = scaleFactorForRecipe(recipe);
}

function updateServingsFromServingGrams(recipe) {
  if (!elements.targetServings || !elements.targetServingGrams) {
    return;
  }

  const totals = totalsForRecipe(recipe);
  const targetServingGrams = numberFromInput(elements.targetServingGrams);
  const adjustedWeight = totals.recipe.weight * (Number(state.scaleFactor) > 0 ? Number(state.scaleFactor) : 1);

  if (adjustedWeight > 0 && targetServingGrams > 0) {
    elements.targetServings.value = Math.max(Math.round(adjustedWeight / targetServingGrams), 1).toString();
  }
}

function renderScaledIngredients(recipe) {
  if (!elements.scaledRows || !elements.scaleHelp) {
    return;
  }

  const targetServings = targetServingsForRecipe(recipe);
  const factor = scaleFactorForRecipe(recipe);
  const totalWeight = totalsForRecipe(recipe).recipe.weight * factor;
  const targetServingGrams = totalWeight / targetServings;
  const breakdownEntries = recipeComponents(recipe).map((component) => batchBreakdownEntryForComponent(component, factor));

  elements.scaleHelp.textContent = `Batch totals for ${targetServings} ${targetServings === 1 ? "serving" : "servings"} at ${formatGrams(targetServingGrams)} each. Expand ingredient groups or recipe components to see internal ingredient amounts.`;
  elements.scaledRows.innerHTML = "";

  if (!breakdownEntries.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "Add components to see scaled ingredient amounts.";
    row.append(cell);
    elements.scaledRows.append(row);
    return;
  }

  breakdownEntries.forEach((entry) => {
    renderBatchBreakdownRow(entry).forEach((row) => {
      elements.scaledRows.append(row);
    });
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
      if (target.closest(".autocomplete-field")) {
        return;
      }

      event.preventDefault();
      target.blur();
      renderOutputs();
    }
  });

  elements.addIngredientButton.addEventListener("click", () => {
    addComponentRow(emptyComponent(), { expanded: false, focusName: true });
    markDirty();
    renderOutputs();
  });

  if (elements.addSavedIngredientButton) {
    elements.addSavedIngredientButton.addEventListener("click", addSelectedSavedIngredient);
  }

  if (elements.newRecipeButton) {
    elements.newRecipeButton.addEventListener("click", newRecipe);
  }

  if (elements.deleteRecipeButton) {
    elements.deleteRecipeButton.addEventListener("click", deleteCurrentRecipe);
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertCurrentRecipe();
  });

  elements.recipeName.addEventListener("input", recognizeRecipeNameState);
  elements.recipeName.addEventListener("change", recognizeRecipeNameState);

  [elements.recipeServings].forEach((input) => {
    input.addEventListener("input", () => {
      if (elements.targetServings && (!elements.targetServings.value || Number(elements.targetServings.value) < 1)) {
        elements.targetServings.value = formatWholeInputNumber(numberFromInput(elements.recipeServings));
      }
      if (elements.targetServingGrams) {
        const totals = totalsForRecipe(currentRecipe());
        elements.targetServingGrams.value = totals.serving.weight ? formatInputNumber(totals.serving.weight) : "";
      }
      markDirty();
      renderOutputs();
    });
  });

  if (elements.targetServings) {
    elements.targetServings.addEventListener("input", () => {
      state.lastScaleInput = "servings";
      markDirty();
      renderOutputs();
    });
  }

  if (elements.sellingPriceInput) {
    elements.sellingPriceInput.addEventListener("input", () => {
      renderOutputs();
    });
  }

  if (elements.resetScaleButton) {
    elements.resetScaleButton.addEventListener("click", () => {
      const recipe = currentRecipe();
      resetScaleControls(recipe);
      markDirty();
      renderOutputs();
    });
  }
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
    renderLandingDashboard();
  }
}

init();
