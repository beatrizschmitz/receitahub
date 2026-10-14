import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type UserRecipeInsert = Database["public"]["Tables"]["user_recipes"]["Insert"];

// Antes de o banco receber a coluna `nutrition` (migração 20261014180000), o
// PostgREST recusa o insert com "Could not find the 'nutrition' column".
// Nesse caso a receita é salva mesmo assim, sem os macros — assim o site não
// quebra se o código for publicado antes do SQL.
function isMissingNutritionColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || /nutrition/i.test(error.message ?? "");
}

/** Salva uma receita do usuário. Devolve a linha criada (ou o erro). */
export async function insertUserRecipe(row: UserRecipeInsert) {
  const first = await supabase.from("user_recipes").insert(row).select("*").maybeSingle();
  if (first.error && "nutrition" in row && isMissingNutritionColumn(first.error)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nutrition: _omit, ...rest } = row;
    return supabase.from("user_recipes").insert(rest).select("*").maybeSingle();
  }
  return first;
}

/** Guarda os macros de uma receita já salva. Falha em silêncio se a coluna ainda não existe. */
export async function saveRecipeNutrition(
  recipeId: string,
  nutrition: { calories: number; protein: number; carbs: number; fat: number },
  fillCalories: boolean,
): Promise<void> {
  const update: Database["public"]["Tables"]["user_recipes"]["Update"] = { nutrition };
  if (fillCalories) update.calories_per_serving = nutrition.calories;
  const { error } = await supabase.from("user_recipes").update(update).eq("id", recipeId);
  if (error && !isMissingNutritionColumn(error)) console.error("saveRecipeNutrition", error);
  if (error && isMissingNutritionColumn(error) && fillCalories) {
    await supabase
      .from("user_recipes")
      .update({ calories_per_serving: nutrition.calories })
      .eq("id", recipeId);
  }
}
