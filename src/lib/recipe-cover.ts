import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Banana,
  Bean,
  Beef,
  CakeSlice,
  Carrot,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  Drumstick,
  EggFried,
  Fish,
  Flame,
  Ham,
  IceCreamCone,
  Martini,
  Milk,
  Nut,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Shell,
  Soup,
  Sprout,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Wheat,
  Wine,
} from "lucide-react";

export type RecipeIconName = keyof typeof RECIPE_ICONS;

// Ícone vetorial no lugar do emoji: mesma leitura, tom editorial.
export const RECIPE_ICONS = {
  Apple,
  Banana,
  Bean,
  Beef,
  CakeSlice,
  Carrot,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  Drumstick,
  EggFried,
  Fish,
  Flame,
  Ham,
  IceCreamCone,
  Martini,
  Milk,
  Nut,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Shell,
  Soup,
  Sprout,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Wheat,
  Wine,
} satisfies Record<string, LucideIcon>;

// Matcher compartilhado de ícone e fundo por receita.
// Prioridade: palavras-chave do título > ingredientes > categoria.

export type RecipeStyle = { icon: RecipeIconName; bg: string };

const CATEGORY_STYLE: Record<string, RecipeStyle> = {
  "prato principal": { icon: "UtensilsCrossed", bg: "from-amber-900/40 to-amber-800/20 light:from-amber-200/70 light:to-amber-100/60" },
  "massa":           { icon: "Wheat", bg: "from-orange-900/40 to-orange-800/20 light:from-orange-200/70 light:to-orange-100/60" },
  "salada":          { icon: "Salad", bg: "from-green-900/40 to-green-800/20 light:from-green-200/70 light:to-green-100/60" },
  "sobremesa":       { icon: "Dessert", bg: "from-pink-900/40 to-pink-800/20 light:from-pink-200/70 light:to-pink-100/60" },
  "pães":            { icon: "Wheat", bg: "from-yellow-900/40 to-yellow-800/20 light:from-yellow-200/70 light:to-yellow-100/60" },
  "pao":             { icon: "Wheat", bg: "from-yellow-900/40 to-yellow-800/20 light:from-yellow-200/70 light:to-yellow-100/60" },
  "sopa":            { icon: "Soup", bg: "from-red-900/40 to-red-800/20 light:from-red-200/70 light:to-red-100/60" },
  "café da manhã":   { icon: "Coffee", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },
  "lanche":          { icon: "Popcorn", bg: "from-lime-900/40 to-lime-800/20 light:from-lime-200/70 light:to-lime-100/60" },
  "bebida":          { icon: "CupSoda", bg: "from-cyan-900/40 to-cyan-800/20 light:from-cyan-200/70 light:to-cyan-100/60" },
  "conserva":        { icon: "Bean", bg: "from-zinc-800/60 to-zinc-700/30 light:from-zinc-100/70 light:to-zinc-100/60" },
  "acompanhamento":  { icon: "Carrot", bg: "from-emerald-900/40 to-emerald-800/20 light:from-emerald-200/70 light:to-emerald-100/60" },
  "entrada":         { icon: "UtensilsCrossed", bg: "from-stone-800/60 to-stone-700/30 light:from-stone-100/70 light:to-stone-100/60" },
  "frutos do mar":   { icon: "Shell", bg: "from-blue-900/40 to-cyan-800/20 light:from-blue-200/70 light:to-cyan-100/60" },
  "peixe":           { icon: "Fish", bg: "from-sky-900/40 to-sky-800/20 light:from-sky-200/70 light:to-sky-100/60" },
  "frango":          { icon: "Drumstick", bg: "from-amber-900/40 to-orange-800/20 light:from-amber-200/70 light:to-orange-100/60" },
  "carne":           { icon: "Beef", bg: "from-red-900/50 to-amber-900/30 light:from-red-200/70 light:to-amber-200/60" },
  "vegano":          { icon: "Vegan", bg: "from-green-900/40 to-emerald-800/20 light:from-green-200/70 light:to-emerald-100/60" },
  "vegetariano":     { icon: "Sprout", bg: "from-emerald-900/40 to-green-800/20 light:from-emerald-200/70 light:to-green-100/60" },
  "default":         { icon: "UtensilsCrossed", bg: "from-zinc-800/60 to-zinc-700/30 light:from-zinc-100/70 light:to-zinc-100/60" },
};

// Ordem importa: regras mais específicas primeiro.
const KEYWORDS: Array<{ match: RegExp; icon: RecipeIconName; bg: string }> = [
  // Brasil
  { match: /feijoada/i,                    icon: "Soup", bg: "from-stone-900/60 to-amber-950/40 light:from-stone-200/70 light:to-amber-300/60" },
  { match: /feijão|feijao|tutu|baião|baiao/i, icon: "Soup", bg: "from-stone-900/60 to-amber-950/40 light:from-stone-200/70 light:to-amber-300/60" },
  { match: /moqueca|bobó|bobo de camarão/i, icon: "Shell", bg: "from-orange-900/40 to-red-800/20 light:from-orange-200/70 light:to-red-100/60" },
  { match: /acarajé|acaraje|vatapá|vatapa|caruru/i, icon: "Soup", bg: "from-amber-900/40 to-red-900/30 light:from-amber-200/70 light:to-red-200/60" },
  { match: /carne seca|carne de sol|charque/i, icon: "Ham", bg: "from-red-950/50 to-amber-900/30 light:from-red-300/70 light:to-amber-200/60" },
  { match: /estrogonofe|strogonoff|estrogonofe/i, icon: "Soup", bg: "from-orange-900/40 to-stone-800/40 light:from-orange-200/70 light:to-stone-100/60" },
  { match: /escondidinho|purê|pure de|mandioca|aipim|macaxeira/i, icon: "Utensils", bg: "from-amber-900/40 to-stone-800/40 light:from-amber-200/70 light:to-stone-100/60" },
  { match: /pinhão|pinhao/i,               icon: "Nut", bg: "from-amber-950/60 to-stone-900/40 light:from-amber-300/70 light:to-stone-200/60" },
  { match: /coxinha|croquete|bolinho de queijo|pastel|empada|empadão/i, icon: "Croissant", bg: "from-amber-900/40 to-yellow-800/20 light:from-amber-200/70 light:to-yellow-100/60" },
  { match: /pão de queijo|pao de queijo/i, icon: "Wheat", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },
  { match: /bolinho de chuva|churros|sonho/i, icon: "Wine", bg: "from-amber-900/40 to-rose-800/20 light:from-amber-200/70 light:to-rose-100/60" },
  { match: /brigadeiro|beijinho|paçoca|pacoca|doce de leite/i, icon: "Dessert", bg: "from-amber-950/60 to-stone-900/40 light:from-amber-300/70 light:to-stone-200/60" },
  { match: /pudim|flan|manjar/i,           icon: "CakeSlice", bg: "from-amber-900/40 to-yellow-800/20 light:from-amber-200/70 light:to-yellow-100/60" },
  { match: /tapioca|beiju|cuscuz/i,        icon: "Croissant", bg: "from-stone-800/60 to-amber-900/30 light:from-stone-100/70 light:to-amber-200/60" },
  { match: /açaí|acai/i,                   icon: "Citrus", bg: "from-fuchsia-950/60 to-purple-900/30 light:from-fuchsia-300/70 light:to-purple-200/60" },
  { match: /farofa/i,                      icon: "Croissant", bg: "from-amber-900/40 to-stone-800/40 light:from-amber-200/70 light:to-stone-100/60" },
  { match: /churrasco|picanha|espetinho|linguiça|linguica/i, icon: "Flame", bg: "from-red-900/50 to-amber-900/30 light:from-red-200/70 light:to-amber-200/60" },
  { match: /caipirinha|batida/i,           icon: "Martini", bg: "from-lime-900/40 to-cyan-800/20 light:from-lime-200/70 light:to-cyan-100/60" },

  // Massas e pizzas
  { match: /lasanha|lasagna/i,             icon: "Wheat", bg: "from-red-900/40 to-orange-800/20 light:from-red-200/70 light:to-orange-100/60" },
  { match: /nhoque|gnocchi/i,              icon: "Wheat", bg: "from-amber-900/40 to-stone-800/40 light:from-amber-200/70 light:to-stone-100/60" },
  { match: /pizza|calzone/i,               icon: "Pizza", bg: "from-red-900/40 to-orange-800/20 light:from-red-200/70 light:to-orange-100/60" },
  { match: /macarrão|macarrao|espaguete|spaghetti|penne|talharim|massa|pasta|carbonara/i, icon: "Wheat", bg: "from-orange-900/40 to-red-800/20 light:from-orange-200/70 light:to-red-100/60" },

  // Arroz e grãos
  { match: /risoto|risotto/i,              icon: "Utensils", bg: "from-stone-800/60 to-amber-900/30 light:from-stone-100/70 light:to-amber-200/60" },
  { match: /arroz/i,                       icon: "Utensils", bg: "from-stone-800/60 to-amber-900/30 light:from-stone-100/70 light:to-amber-200/60" },
  { match: /quinoa|grão de bico|grao de bico|lentilha/i, icon: "Sprout", bg: "from-emerald-900/40 to-stone-800/40 light:from-emerald-200/70 light:to-stone-100/60" },
  { match: /polenta|angu/i,                icon: "Utensils", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },

  // Proteínas
  { match: /frango|chicken|galinha|coxa|sobrecoxa|peito de/i, icon: "Drumstick", bg: "from-amber-900/40 to-orange-800/20 light:from-amber-200/70 light:to-orange-100/60" },
  { match: /costela|bife|contra ?filé|patinho|alcatra|carne moída|carne moida|hambúrguer|hamburguer|burger|carne/i, icon: "Beef", bg: "from-red-900/50 to-amber-900/30 light:from-red-200/70 light:to-amber-200/60" },
  { match: /porco|lombo|bacon|pernil|costelinha/i, icon: "Ham", bg: "from-red-950/50 to-amber-900/30 light:from-red-300/70 light:to-amber-200/60" },
  { match: /salmão|salmao|atum|tilápia|tilapia|bacalhau|peixe|sardinha|merluza/i, icon: "Fish", bg: "from-sky-900/40 to-cyan-800/20 light:from-sky-200/70 light:to-cyan-100/60" },
  { match: /camarão|camarao|lula|polvo|mexilhão|frutos do mar|marisco/i, icon: "Shell", bg: "from-orange-900/40 to-red-800/20 light:from-orange-200/70 light:to-red-100/60" },
  { match: /ovo|omelete|fritada|mexido|frittata/i, icon: "EggFried", bg: "from-yellow-900/40 to-orange-800/20 light:from-yellow-200/70 light:to-orange-100/60" },
  { match: /tofu|proteína de soja|proteina de soja|falafel/i, icon: "Vegan", bg: "from-emerald-900/40 to-green-800/20 light:from-emerald-200/70 light:to-green-100/60" },

  // Sopas e caldos
  { match: /canja/i,                       icon: "Soup", bg: "from-amber-900/40 to-yellow-800/20 light:from-amber-200/70 light:to-yellow-100/60" },
  { match: /sopa|caldo|creme de|ensopado|cozido/i, icon: "Soup", bg: "from-red-900/40 to-amber-800/20 light:from-red-200/70 light:to-amber-100/60" },

  // Saladas e vegetais
  { match: /salada|folhas|rúcula|rucula|alface/i, icon: "Salad", bg: "from-green-900/40 to-emerald-800/20 light:from-green-200/70 light:to-emerald-100/60" },
  { match: /abobrinha|berinjela|abóbora|abobora|couve|brócolis|brocolis|legumes|vegetais|verduras|refogado/i, icon: "Carrot", bg: "from-emerald-900/40 to-green-800/20 light:from-emerald-200/70 light:to-green-100/60" },
  { match: /batata|frita|rústica|rustica/i, icon: "Utensils", bg: "from-amber-900/40 to-yellow-800/20 light:from-amber-200/70 light:to-yellow-100/60" },
  { match: /cogumelo|shitake|shimeji|champignon/i, icon: "Milk", bg: "from-stone-800/60 to-amber-900/30 light:from-stone-100/70 light:to-amber-200/60" },
  { match: /milho|pamonha/i,               icon: "Utensils", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },
  { match: /tomate|caprese/i,              icon: "Salad", bg: "from-red-900/40 to-green-800/20 light:from-red-200/70 light:to-green-100/60" },
  { match: /cenoura/i,                     icon: "Carrot", bg: "from-orange-900/40 to-amber-800/20 light:from-orange-200/70 light:to-amber-100/60" },

  // Pães e massas doces
  { match: /focaccia|ciabatta|baguete|pão|pao|bread|brioche|sourdough|fermenta/i, icon: "Wheat", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },
  { match: /panqueca|pancake|waffle|crepe|rabanada/i, icon: "CakeSlice", bg: "from-amber-900/40 to-yellow-800/20 light:from-amber-200/70 light:to-yellow-100/60" },
  { match: /torta|quiche|tarte/i,          icon: "Croissant", bg: "from-amber-900/40 to-rose-800/20 light:from-amber-200/70 light:to-rose-100/60" },
  { match: /cookie|biscoito|bolacha/i,     icon: "Cookie", bg: "from-amber-900/40 to-stone-800/40 light:from-amber-200/70 light:to-stone-100/60" },
  { match: /muffin|cupcake|brownie/i,      icon: "CakeSlice", bg: "from-pink-900/40 to-amber-900/30 light:from-pink-200/70 light:to-amber-200/60" },
  { match: /bolo|cake/i,                   icon: "CakeSlice", bg: "from-pink-900/40 to-rose-800/20 light:from-pink-200/70 light:to-rose-100/60" },

  // Sobremesas e frutas
  { match: /chocolate|cacau|ganache/i,     icon: "Dessert", bg: "from-amber-950/60 to-stone-900/40 light:from-amber-300/70 light:to-stone-200/60" },
  { match: /sorvete|gelato|picolé|picole|milk ?shake/i, icon: "IceCreamCone", bg: "from-pink-900/40 to-cyan-800/20 light:from-pink-200/70 light:to-cyan-100/60" },
  { match: /morango|framboesa|amora|frutas vermelhas/i, icon: "Milk", bg: "from-pink-900/40 to-rose-800/20 light:from-pink-200/70 light:to-rose-100/60" },
  { match: /banana/i,                      icon: "Banana", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },
  { match: /abacaxi/i,                     icon: "Citrus", bg: "from-yellow-900/40 to-lime-800/20 light:from-yellow-200/70 light:to-lime-100/60" },
  { match: /manga|mango/i,                 icon: "Citrus", bg: "from-orange-900/40 to-amber-800/20 light:from-orange-200/70 light:to-amber-100/60" },
  { match: /maçã|maca assada|apple/i,      icon: "Apple", bg: "from-red-900/40 to-amber-800/20 light:from-red-200/70 light:to-amber-100/60" },
  { match: /limão|limao|lemon/i,           icon: "Citrus", bg: "from-lime-900/40 to-yellow-800/20 light:from-lime-200/70 light:to-yellow-100/60" },
  { match: /laranja|tangerina/i,           icon: "Citrus", bg: "from-orange-900/40 to-yellow-800/20 light:from-orange-200/70 light:to-yellow-100/60" },
  { match: /coco|cocada/i,                 icon: "Citrus", bg: "from-stone-800/60 to-amber-900/30 light:from-stone-100/70 light:to-amber-200/60" },
  { match: /uva|vinho/i,                   icon: "Wine", bg: "from-purple-950/60 to-fuchsia-900/30 light:from-purple-300/70 light:to-fuchsia-200/60" },
  { match: /melancia|melão|melao/i,        icon: "Milk", bg: "from-rose-900/40 to-green-800/20 light:from-rose-200/70 light:to-green-100/60" },
  { match: /mel|granola|aveia|iogurte/i,   icon: "Milk", bg: "from-amber-900/40 to-yellow-800/20 light:from-amber-200/70 light:to-yellow-100/60" },
  { match: /queijo|cheese|requeijão/i,     icon: "Milk", bg: "from-yellow-900/40 to-amber-800/20 light:from-yellow-200/70 light:to-amber-100/60" },

  // Mundo
  { match: /sushi|temaki|sashimi/i,        icon: "Fish", bg: "from-red-950/50 to-stone-900/40 light:from-red-300/70 light:to-stone-200/60" },
  { match: /ramen|yakisoba|missô|misso|teriyaki|japon|shoyu/i, icon: "Fish", bg: "from-red-950/50 to-amber-900/30 light:from-red-300/70 light:to-amber-200/60" },
  { match: /taco|burrito|nacho|guacamole|mexican|chili/i, icon: "Flame", bg: "from-orange-900/40 to-red-800/20 light:from-orange-200/70 light:to-red-100/60" },
  { match: /curry|tikka|indiana|masala/i,  icon: "Soup", bg: "from-amber-900/40 to-orange-800/20 light:from-amber-200/70 light:to-orange-100/60" },
  { match: /hummus|árabe|arabe|kibe|esfiha|shawarma/i, icon: "Croissant", bg: "from-amber-900/40 to-stone-800/40 light:from-amber-200/70 light:to-stone-100/60" },
  { match: /pad thai|tailand|thai|wok|chinês|chines/i, icon: "Soup", bg: "from-orange-900/40 to-red-800/20 light:from-orange-200/70 light:to-red-100/60" },
  { match: /grego|tzatziki|souvlaki/i,     icon: "Croissant", bg: "from-sky-900/40 to-emerald-800/20 light:from-sky-200/70 light:to-emerald-100/60" },

  // Bebidas
  { match: /café|cafe|cappuccino|latte/i,  icon: "Coffee", bg: "from-stone-900/60 to-amber-950/40 light:from-stone-200/70 light:to-amber-300/60" },
  { match: /chá|cha verde|matcha/i,        icon: "Coffee", bg: "from-emerald-900/40 to-green-800/20 light:from-emerald-200/70 light:to-green-100/60" },
  { match: /suco|smoothie|vitamina|limonada|drink/i, icon: "CupSoda", bg: "from-cyan-900/40 to-sky-800/20 light:from-cyan-200/70 light:to-sky-100/60" },
  { match: /bowl|tropical/i,               icon: "Citrus", bg: "from-fuchsia-900/40 to-pink-800/20 light:from-fuchsia-200/70 light:to-pink-100/60" },

  // Lanches
  { match: /sanduíche|sanduiche|sandwich|wrap|tostex|misto quente/i, icon: "Sandwich", bg: "from-lime-900/40 to-amber-800/20 light:from-lime-200/70 light:to-amber-100/60" },
  { match: /pipoca|snack|petisco/i,        icon: "Popcorn", bg: "from-yellow-900/40 to-stone-800/40 light:from-yellow-200/70 light:to-stone-100/60" },
];

export function getRecipeStyle(
  title?: string | null,
  category?: string | null,
  ingredients?: string[] | null,
): RecipeStyle {
  const t = title ?? "";
  const byTitle = KEYWORDS.find((k) => k.match.test(t));
  if (byTitle) return { icon: byTitle.icon, bg: byTitle.bg };

  const ing = (ingredients ?? []).join(" ");
  if (ing) {
    const byIng = KEYWORDS.find((k) => k.match.test(ing));
    if (byIng) return { icon: byIng.icon, bg: byIng.bg };
  }

  const lower = (category ?? "").toLowerCase();
  const key = Object.keys(CATEGORY_STYLE).find((k) => lower.includes(k));
  return CATEGORY_STYLE[key ?? "default"]!;
}
