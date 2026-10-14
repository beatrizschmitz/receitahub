// Prompts que pedem à IA para identificar alimentos da TACO. Ficam num módulo
// próprio para o servidor e os testes manuais usarem exatamente o mesmo texto.

import type { NutritionTargets } from "./nutrition.ts";
import { promptFoodList } from "./taco.ts";

export const RECIPE_SYSTEM =
  "Você é um nutricionista brasileiro. Para cada ingrediente de uma receita, identifique o alimento correspondente na tabela TACO e a quantidade usada. Responda SOMENTE com JSON válido, sem markdown.";

export function recipeTacoPrompt(title: string, ingredients: string[], servings: number): string {
  return `Receita: ${title} (rende ${servings} porções)

Ingredientes:
${ingredients.map((i, n) => `${n + 1}. ${i}`).join("\n")}

Tabela TACO (id e nome):
${promptFoodList()}

REGRAS
- Para cada ingrediente, na mesma ordem, copie EXATAMENTE o id e o nome do alimento da tabela. Use taco_id null se não houver equivalente.
- Escolha o estado certo do alimento: o que entra cru na receita é "cru" (ex.: arroz que vai ser cozido na própria receita é "Arroz, tipo 1, cru"); o que já vem pronto é "cozido".
- A TACO é por parte comestível. Se o ingrediente vem com osso, casca, pele ou caroço (frango inteiro, peixe inteiro, melancia, abacate), informe em amount apenas a parte comestível estimada (ex.: frango inteiro de 1,8 kg com osso ≈ 1170 g).
- Informe a quantidade como número (amount) e uma unidade (unit) EXATAMENTE desta lista: g, kg, mL, L, colher de sopa, colher de chá, xícara, copo, unidade, dente, fatia, maço, lata, cubo, pitada, a gosto.
- Para "unidade", informe size: pequena, média ou grande.
- negligible true só para temperos e itens sem peso relevante (sal, pimenta, ervas, folha de louro).
- Não converta medidas caseiras em gramas: apenas informe o número e a unidade que a receita traz.

Formato: {"items":[{"ingredient":"texto original","taco_id":1,"taco_name":"nome na tabela","amount":2,"unit":"colher de sopa","size":"média","negligible":false}]}`;
}

export const DIET_SYSTEM =
  "Você é um nutricionista brasileiro que monta cardápios usando a tabela TACO. Responda SEMPRE em português do Brasil e SOMENTE com JSON válido, sem markdown.";

export function dietTacoPrompt(args: {
  t: NutritionTargets;
  objective: string;
  goalLabel: string;
  colesterol: boolean;
  restrictions: string[];
  notes: string;
  pantry: string[];
}): string {
  const { t } = args;
  const mealLines = t.meals
    .map(
      (m) =>
        `- ${m.meal}: ~${m.kcal} kcal (proteína ${m.proteinG} g, carboidrato ${m.carbsG} g, gordura ${m.fatG} g)`,
    )
    .join("\n");
  const colesterolRule = args.colesterol
    ? "\n- Foco em reduzir o colesterol: gorduras saturadas baixas, muita fibra solúvel (aveia, frutas, leguminosas), peixes e oleaginosas, sem frituras nem embutidos."
    : "";

  return `Monte um plano alimentar de 7 dias (Segunda a Domingo) para esta pessoa, escolhendo alimentos da tabela TACO.

PERFIL
- Sexo: ${t.inputs.sex}, ${t.inputs.age} anos, ${t.inputs.weightKg} kg, ${t.inputs.heightCm} cm (IMC ${t.bmi}, ${t.bmiClass})
- Objetivo: ${args.objective} (${args.goalLabel})
- Restrições alimentares: ${args.restrictions.join(", ") || "nenhuma"}
- Observações (alergias, condições de saúde, rotina): ${args.notes || "nenhuma"}
- Itens que a pessoa já tem na despensa (priorize): ${args.pantry.join(", ") || "não informado"}

METAS DIÁRIAS JÁ CALCULADAS (em TODOS os 7 dias)
- Total: ${t.kcal} kcal | proteína ${t.proteinG} g | carboidrato ${t.carbsG} g | gordura ${t.fatG} g | fibras ${t.fiberG} g
5 refeições por dia, nesta ordem e com estas calorias aproximadas:
${mealLines}

TABELA TACO (id e nome). Use SOMENTE alimentos desta lista:
${promptFoodList()}

REGRAS
- Em cada item, copie EXATAMENTE o id e o nome da tabela e informe as gramas (grams).
- Escolha o estado certo do alimento (cru, cozido, grelhado...), como ele será consumido.
- O sistema calcula os nutrientes pela tabela e ajusta as gramas de cada refeição para fechar a meta; por isso o que importa é a ESCOLHA dos alimentos e a proporção entre eles (proteína, carboidrato, vegetais, gordura), com gramas realistas.
- Cada refeição deve ter de 2 a 6 itens. Distribua proteína suficiente ao longo do dia para chegar perto de ${t.proteinG} g.
- Use alimentos comuns e baratos no Brasil, respeite TODAS as restrições e alergias, varie os pratos ao longo da semana e priorize a despensa.
- Não faça nenhuma promessa de tratamento nem indique suplementos ou medicamentos.${colesterolRule}

Responda SOMENTE com JSON válido neste formato exato:
{"title":"","summary":"resumo curto do plano","tips":["dica prática"],"days":[{"day":"Segunda","meals":[{"meal":"Café da manhã","name":"nome do prato","description":"modo de preparo curto","items":[{"taco_id":1,"taco_name":"nome na tabela","grams":120}]}]}]}`;
}
