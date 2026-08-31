import recipe1 from "@/assets/recipe-1.jpg";
import recipe2 from "@/assets/recipe-2.jpg";
import recipe3 from "@/assets/recipe-3.jpg";
import recipe4 from "@/assets/recipe-4.jpg";
import recipe5 from "@/assets/recipe-5.jpg";
import recipe6 from "@/assets/recipe-6.jpg";

export type Recipe = {
  id: string;
  title: string;
  image: string;
  category: string;
  time: number;
  difficulty: "fácil" | "médio" | "difícil";
  diet: string[];
  description: string;
  matchPercent: number;
  saved?: boolean;
  ingredients?: string[];
  instructions?: string;
  time_minutes?: number;
};

export const recipes: Recipe[] = [
  {
    id: "risoto-cogumelos",
    title: "Risoto cremoso de cogumelos",
    image: recipe1,
    category: "Prato principal",
    time: 35,
    difficulty: "médio",
    diet: ["vegetariano"],
    description:
      "Arroz arbóreo cozido lentamente com caldo, cogumelos paris e parmesão. Conforto em forma de prato.",
    matchPercent: 100,
    saved: true,
    ingredients: [
      "1 xícara de arroz arbóreo",
      "300 g de cogumelos paris fatiados",
      "1 litro de caldo de legumes quente",
      "1 cebola pequena picada",
      "2 dentes de alho picados",
      "1/2 xícara de vinho branco seco",
      "50 g de parmesão ralado",
      "2 colheres de sopa de manteiga",
      "Azeite, sal e pimenta-do-reino a gosto",
    ],
    instructions:
      "1. Refogue os cogumelos no azeite em fogo alto até dourarem e reserve.\n2. Na mesma panela, refogue a cebola e o alho até ficarem translúcidos.\n3. Junte o arroz e mexa por 2 minutos para selar os grãos.\n4. Adicione o vinho e deixe evaporar. Vá acrescentando o caldo quente uma concha por vez, mexendo sempre, até o arroz ficar al dente.\n5. Fora do fogo, incorpore os cogumelos, a manteiga e o parmesão. Sirva imediatamente.",
  },
  {
    id: "pasta-pomodoro",
    title: "Spaghetti al pomodoro",
    image: recipe2,
    category: "Massa",
    time: 20,
    difficulty: "fácil",
    diet: ["vegetariano"],
    description:
      "Tomate maduro, manjericão fresco e azeite extra virgem. A pasta italiana mais essencial.",
    matchPercent: 92,
    ingredients: [
      "400 g de spaghetti",
      "800 g de tomates maduros sem pele, picados",
      "3 dentes de alho laminados",
      "1 maço de manjericão fresco",
      "4 colheres de sopa de azeite extra virgem",
      "Sal e uma pitada de açúcar",
    ],
    instructions:
      "1. Doure o alho no azeite em fogo baixo, sem deixar queimar.\n2. Junte os tomates, o sal e o açúcar. Cozinhe por 20 minutos, amassando com a colher.\n3. Cozinhe o spaghetti em água salgada até ficar al dente e reserve um pouco da água do cozimento.\n4. Misture a massa ao molho, acrescentando a água reservada até atingir o ponto cremoso.\n5. Finalize com manjericão rasgado e um fio de azeite.",
  },
  {
    id: "salada-rome",
    title: "Salada de romã & abacate",
    image: recipe3,
    category: "Salada",
    time: 10,
    difficulty: "fácil",
    diet: ["vegano", "sem glúten"],
    description:
      "Folhas verdes, abacate cremoso e sementes de romã com vinagrete cítrico de limão siciliano.",
    matchPercent: 78,
    ingredients: [
      "1 abacate maduro em fatias",
      "Sementes de 1 romã",
      "120 g de folhas verdes variadas",
      "1/4 de cebola roxa em fatias finas",
      "Suco de 1 limão siciliano",
      "3 colheres de sopa de azeite extra virgem",
      "Sal e pimenta-do-reino a gosto",
    ],
    instructions:
      "1. Bata o suco de limão com o azeite, o sal e a pimenta até emulsionar.\n2. Lave e seque bem as folhas e disponha na travessa.\n3. Distribua o abacate, a cebola roxa e as sementes de romã por cima.\n4. Regue com o vinagrete apenas na hora de servir, para as folhas não murcharem.",
  },
  {
    id: "frango-assado",
    title: "Frango assado com ervas",
    image: recipe4,
    category: "Prato principal",
    time: 75,
    difficulty: "médio",
    diet: ["sem glúten", "low carb"],
    description:
      "Frango inteiro marinado em alecrim, alho e limão, assado lentamente até a pele dourar.",
    matchPercent: 85,
    saved: true,
    ingredients: [
      "1 frango inteiro (cerca de 1,8 kg)",
      "4 dentes de alho amassados",
      "2 ramos de alecrim fresco",
      "1 limão cortado ao meio",
      "3 colheres de sopa de azeite",
      "1 colher de sopa de sal grosso",
      "Pimenta-do-reino moída na hora",
    ],
    instructions:
      "1. Misture o alho, o azeite, o sal, a pimenta e as folhas de um ramo de alecrim.\n2. Esfregue a marinada por fora e por dentro do frango e deixe descansar por 1 hora na geladeira.\n3. Coloque o limão e o alecrim restante dentro da cavidade e amarre as coxas.\n4. Asse a 200 °C por cerca de 1 hora e 15 minutos, regando com o próprio caldo a cada 20 minutos.\n5. Deixe descansar 10 minutos antes de cortar, para os sucos se redistribuírem.",
  },
  {
    id: "torta-chocolate",
    title: "Torta de chocolate & framboesa",
    image: recipe5,
    category: "Sobremesa",
    time: 60,
    difficulty: "difícil",
    diet: ["vegetariano"],
    description:
      "Massa de cacau com ganache intenso e framboesas frescas. Para os dias que pedem indulgência.",
    matchPercent: 64,
    ingredients: [
      "200 g de biscoito de chocolate triturado",
      "90 g de manteiga derretida",
      "300 g de chocolate meio amargo picado",
      "250 ml de creme de leite fresco",
      "200 g de framboesas frescas",
      "1 colher de sopa de açúcar",
    ],
    instructions:
      "1. Misture o biscoito triturado com a manteiga e forre o fundo e as laterais de uma forma de aro removível. Leve à geladeira por 20 minutos.\n2. Aqueça o creme de leite até quase ferver e despeje sobre o chocolate picado. Espere 1 minuto e mexa até obter um ganache liso.\n3. Despeje o ganache sobre a base e leve à geladeira por no mínimo 4 horas.\n4. Cubra com as framboesas polvilhadas com açúcar pouco antes de servir.",
  },
  {
    id: "pao-rustico",
    title: "Pão rústico de fermentação natural",
    image: recipe6,
    category: "Pães",
    time: 240,
    difficulty: "difícil",
    diet: ["vegano"],
    description: "Casca crocante, miolo aerado e sabor profundo. Tempo é o ingrediente principal.",
    matchPercent: 70,
    ingredients: [
      "500 g de farinha de trigo",
      "350 ml de água filtrada",
      "100 g de fermento natural ativo (levain)",
      "10 g de sal",
    ],
    instructions:
      "1. Misture a farinha com a água e descanse por 40 minutos (autólise).\n2. Incorpore o levain e, depois de 20 minutos, o sal. Sove até a massa ficar homogênea.\n3. Faça dobras a cada 30 minutos durante as primeiras 3 horas de fermentação.\n4. Modele a massa, coloque em um cesto enfarinhado e leve à geladeira de 12 a 16 horas.\n5. Asse em panela de ferro tampada a 240 °C por 20 minutos; destampe e asse por mais 20 minutos até dourar.",
  },
];
