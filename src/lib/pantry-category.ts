// Categorias da despensa e sugestão automática a partir do nome digitado.
// Primeiro tenta o dicionário local (instantâneo, sem custo); o que ele não
// reconhecer segue para a IA (categorizeIngredient em ai.functions.ts).

export const CATEGORIES = [
  "Grãos",
  "Cereais",
  "Massas",
  "Frutas",
  "Vegetais",
  "Legumes",
  "Verduras",
  "Proteínas",
  "Carnes",
  "Peixes e Frutos do Mar",
  "Laticínios",
  "Ovos",
  "Pães",
  "Ervas",
  "Temperos",
  "Óleos",
  "Molhos e Condimentos",
  "Enlatados",
  "Congelados",
  "Doces e Açúcares",
  "Bebidas",
  "Snacks",
  "Outros",
] as const;

// Palavras-chave sem acento e no singular. Entre as que baterem no nome
// digitado, vence a mais específica (mais longa) — ver suggestCategory.
const CATEGORY_KEYWORDS: Array<[string[], string]> = [
  [
    [
      "arroz", "aveia", "granola", "quinoa", "cevada", "centeio", "trigo", "farinha", "fuba",
      "polvilho", "amido de milho", "maisena", "tapioca", "cuscuz", "flocos de milho", "sucrilhos",
      "cereal", "pao ralado", "farelo", "linhaca", "chia", "gergelim", "semente", "milho de pipoca",
      "canjica", "trigo para quibe", "farinha de rosca", "farofa", "musli", "muesli", "arroz integral",
    ],
    "Cereais",
  ],
  [
    [
      "feijao", "lentilha", "grao de bico", "ervilha seca", "soja", "feijao preto", "feijao carioca",
      "feijao fradinho", "feijao branco", "feijao verde", "fava", "milho seco",
    ],
    "Grãos",
  ],
  [
    [
      "macarrao", "espaguete", "lasanha", "nhoque", "massa", "talharim", "parafuso", "penne",
      "fusilli", "fettuccine", "capeletti", "ravioli", "tortellini", "miojo", "lamen", "udon",
      "yakisoba", "macarronese", "massa de pastel", "massa folhada", "massa de lasanha", "rigatoni",
    ],
    "Massas",
  ],
  [
    [
      "banana", "maca", "laranja", "uva", "manga", "abacaxi", "morango", "limao", "mamao",
      "melancia", "pera", "abacate", "kiwi", "pessego", "ameixa", "melao", "tangerina", "mexerica",
      "goiaba", "coco", "caqui", "figo", "framboesa", "mirtilo", "amora", "cereja", "maracuja",
      "acerola", "caju", "cupuacu", "jabuticaba", "lichia", "pitaya", "nectarina", "damasco", "romã",
      "roma", "carambola", "jaca", "graviola", "pomelo", "bergamota", "uva passa", "tamara", "fruta",
      "banana prata", "banana nanica", "limao siciliano", "laranja pera", "cranberry", "atemoia",
      "pinha", "fruta do conde", "seriguela", "umbu", "pitanga", "cajá", "caja", "physalis",
    ],
    "Frutas",
  ],
  [
    [
      "tomate", "batata", "cebola", "alho", "cenoura", "abobrinha", "pepino", "pimentao", "beterraba",
      "abobora", "chuchu", "mandioca", "aipim", "macaxeira", "batata doce", "milho verde", "vagem",
      "berinjela", "quiabo", "jiló", "jilo", "inhame", "mandioquinha", "batata baroa",
      "cogumelo", "champignon", "shitake", "shimeji", "palmito", "aspargo", "alcachofra", "nabo",
      "rabanete", "gengibre", "cebola roxa", "alho poro", "alho-poro", "echalota", "maxixe", "ervilha",
      "ervilha torta", "milho", "pimenta", "pimenta dedo de moca", "pimenta malagueta", "erva doce",
      "salsao", "aipo", "couve flor", "couve-flor", "tomate cereja", "batata inglesa", "legume",
      "abobora cabotia", "abobora moranga", "brocolis ninja",
    ],
    "Legumes",
  ],
  [
    [
      "alface", "couve", "espinafre", "rucula", "brocolis", "repolho", "agriao", "acelga", "escarola",
      "radiche", "chicoria", "mostarda folha", "folha", "verdura", "almeirao", "taioba", "ora pro nobis",
      "mizuna", "alface americana", "alface crespa", "alface roxa", "couve de bruxelas", "broto",
      "brotos", "repolho roxo", "couve manteiga", "cebolinha verde",
    ],
    "Verduras",
  ],
  [
    [
      "frango", "carne moida", "carne bovina", "file", "bife", "costela", "picanha", "linguica",
      "bacon", "peru", "carne suina", "lombo", "presunto", "carne", "acem", "patinho", "coxao",
      "alcatra", "fraldinha", "maminha", "contra file", "file mignon", "cupim", "lagarto", "musculo",
      "carne seca", "charque", "costelinha", "pernil", "paleta", "copa", "salsicha", "salame",
      "mortadela", "calabresa", "peito de frango", "coxa", "sobrecoxa", "asa de frango", "figado",
      "coracao", "rabada", "peito de peru", "blanquet", "apresuntado", "hamburguer", "almondega",
      "linguica toscana", "paio", "pato", "coelho", "cordeiro", "carneiro", "cabrito", "bisteca",
      "lingua", "dobradinha", "bucho", "mocoto", "kafta", "kibe", "quibe",
    ],
    "Carnes",
  ],
  [
    [
      "peixe", "salmao", "tilapia", "camarao", "atum fresco", "bacalhau", "lula", "polvo",
      "sardinha fresca", "merluza", "pescada", "robalo", "dourado", "tambaqui", "pintado", "truta",
      "linguado", "badejo", "anchova", "caranguejo", "siri", "lagosta", "mexilhao", "ostra", "marisco",
      "vieira", "surubim", "pirarucu", "namorado", "cacao", "peixe branco", "frutos do mar", "polvo",
      "camarao rosa", "pacu", "carpa", "manjuba", "arenque", "filé de peixe",
    ],
    "Peixes e Frutos do Mar",
  ],
  [
    [
      "leite", "queijo", "iogurte", "manteiga", "requeijao", "creme de leite", "nata", "mussarela",
      "mucarela", "parmesao", "ricota", "cottage", "coalhada", "kefir", "leite condensado",
      "leite em po", "margarina", "cream cheese", "gorgonzola", "provolone", "queijo minas",
      "queijo prato", "coalho", "queijo coalho", "brie", "camembert", "cheddar", "gruyere",
      "emmental", "feta", "burrata", "mascarpone", "chantilly", "leite de cabra", "leitelho",
      "danone", "petit suisse", "yakult", "creme de ricota", "laticinio", "bebida lactea",
    ],
    "Laticínios",
  ],
  [["ovo", "clara", "gema", "ovo de codorna", "ovos"], "Ovos"],
  [
    [
      "pao", "baguete", "torrada", "wrap", "tortilha", "bisnaga", "pao de forma", "pao frances",
      "pao integral", "pao sirio", "pao de queijo", "croissant", "brioche", "ciabatta", "focaccia",
      "bagel", "pita", "naan", "pao de hamburguer", "pao de hot dog", "pao australiano", "forma",
      "massa de pizza", "pizza", "rosca", "broa", "bolo", "panqueca", "cuca", "sonho", "pao doce",
    ],
    "Pães",
  ],
  [
    [
      "manjericao", "salsa", "cebolinha", "coentro", "oregano", "alecrim", "hortela", "tomilho",
      "louro", "sálvia", "salvia", "endro", "dill", "estragao", "manjerona", "folha de louro",
      "capim limao", "cidreira", "erva", "ervas", "ervas finas", "cheiro verde", "menta", "boldo",
      "camomila", "erva cidreira", "losna", "lavanda", "sementes de erva doce",
    ],
    "Ervas",
  ],
  [
    [
      "sal", "pimenta do reino", "curcuma", "acafrao", "cominho", "canela", "paprica", "curry",
      "colorau", "noz moscada", "tempero", "cravo", "cardamomo", "anis", "anis estrelado", "pimenta",
      "pimenta calabresa", "pimenta branca", "pimenta rosa", "chimichurri", "garam masala", "baunilha",
      "sal grosso", "sal rosa", "sal do himalaia", "flor de sal", "alho em po", "cebola em po",
      "caldo", "caldo de galinha", "caldo de carne", "knorr", "sazon", "fondor", "tempero pronto",
      "pimenta do reino moida", "lemon pepper", "mix de temperos", "especiaria", "zaatar", "sumac",
      "fermento", "bicarbonato", "gelatina", "gelatina sem sabor", "corante", "essencia", "glutamato",
    ],
    "Temperos",
  ],
  [
    [
      "azeite", "oleo de soja", "oleo de girassol", "oleo de coco", "oleo", "oleo de canola",
      "oleo de milho", "azeite de oliva", "azeite extra virgem", "oleo de gergelim", "gordura",
      "gordura vegetal", "banha", "ghee", "oleo de abacate", "spray de oleo", "oleo de dende",
      "azeite de dende",
    ],
    "Óleos",
  ],
  [
    [
      "ketchup", "catchup", "maionese", "mostarda", "molho de tomate", "shoyu", "molho barbecue",
      "vinagre", "molho", "molho shoyu", "molho ingles", "molho de pimenta", "tabasco", "sriracha",
      "extrato de tomate", "polpa de tomate", "passata", "pesto", "molho branco", "molho pesto",
      "molho de soja", "molho tarê", "tare", "molho teriyaki", "teriyaki", "molho agridoce",
      "aceto", "balsamico", "vinagre balsamico", "vinagre de maca", "vinagre de vinho", "tahine",
      "pasta de amendoim", "creme de avela", "geleia de pimenta", "chutney", "wasabi",
      "missô", "miso", "hoisin", "molho de ostra", "molho de peixe", "conserva", "picles", "azeitona",
      "alcaparra", "pasta de alho", "cream de cebola", "molho caesar", "molho rosé", "molho de queijo",
      "homus", "guacamole", "molho para salada", "dressing", "condimento",
    ],
    "Molhos e Condimentos",
  ],
  [
    [
      "enlatado", "lata de", "milho em lata", "ervilha em lata", "sardinha em lata", "atum em lata",
      "atum", "sardinha", "lata", "conserva de", "palmito em conserva", "seleta", "seleta de legumes",
      "cogumelo em conserva", "pessego em calda", "frutas em calda", "milho enlatado", "feijoada pronta",
      "atum ralado", "atum solido", "salsicha em lata", "leite de coco", "creme de milho", "tomate pelado",
      "grao de bico em lata", "feijao em lata",
    ],
    "Enlatados",
  ],
  [
    [
      "congelado", "sorvete", "nuggets", "polpa de fruta", "polpa", "pizza congelada", "lasanha congelada",
      "hamburguer congelado", "batata frita congelada", "empanado", "steak de frango", "acai", "picole",
      "gelo", "fruta congelada", "legumes congelados", "vegetais congelados", "pao de queijo congelado",
      "sobremesa gelada", "gelato", "sorvete de creme", "iogurte congelado", "frozen",
    ],
    "Congelados",
  ],
  [
    [
      "acucar", "chocolate", "doce", "mel", "achocolatado", "geleia", "bolo pronto", "açucar",
      "acucar mascavo", "acucar refinado", "acucar cristal", "acucar de confeiteiro", "acucar demerara",
      "adocante", "stevia", "xilitol", "melado", "rapadura", "doce de leite", "goiabada", "marmelada",
      "bananada", "brigadeiro", "granulado", "confeito", "leite condensado doce", "nutella",
      "cacau", "cacau em po", "chocolate em po", "chocolate meio amargo", "chocolate branco", "bombom",
      "bala", "chiclete", "pirulito", "paçoca", "pacoca", "cocada", "pudim", "mousse", "gelatina doce",
      "sobremesa", "torta", "cheesecake", "doce de abobora", "marshmallow", "caramelo", "calda",
      "calda de chocolate", "xarope", "sucralose", "ganache", "trufa", "barra de chocolate",
      "cobertura", "pasta de chocolate", "creme de chocolate", "cacau nibs",
    ],
    "Doces e Açúcares",
  ],
  [
    [
      "agua", "suco", "refrigerante", "cafe", "cha", "cerveja", "vinho", "refresco", "energetico",
      "isotonico", "agua de coco", "agua com gas", "agua mineral", "cha verde", "cha preto",
      "cha mate", "mate", "guarana", "coca cola", "pepsi", "fanta", "sprite", "cachaca", "vodka",
      "whisky", "gin", "rum", "tequila", "licor", "espumante", "champanhe", "sake", "suco de laranja",
      "suco de uva", "limonada", "kombucha", "cafe em po", "capsula de cafe", "nescafe", "cappuccino",
      "leite de aveia", "leite de amendoa", "leite de soja", "leite vegetal", "bebida", "drink",
      "chopp", "chope", "cidra", "campari", "aperol", "vermute", "conhaque", "bebida vegetal",
      "cha gelado", "soda", "tonica", "agua tonica", "ice tea", "capuccino", "chocolate quente",
      "toddy", "nescau", "ovomaltine",
    ],
    "Bebidas",
  ],
  [
    [
      "biscoito", "salgadinho", "pipoca", "amendoim", "castanha", "bolacha", "chips", "batata chips",
      "doritos", "cheetos", "ruffles", "pringles", "torresmo", "pretzel", "cracker", "bolacha de agua e sal",
      "biscoito recheado", "wafer", "barra de cereal", "barrinha", "granola em barra", "castanha de caju",
      "castanha do para", "nozes", "noz", "amendoa", "avela", "pistache", "macadamia", "pecan",
      "mix de castanhas", "mix de nuts", "frutas secas", "fruta seca", "uva passa snack", "amendoim japones",
      "tortilla chips", "nachos", "pao de queijo snack", "mandioca frita", "polvilho azedo", "biscoito de polvilho",
      "snack", "petisco", "batata palha", "salgadinho de milho", "cookie", "bolinho", "rosquinha", "rosquinhas",
      "chocolate snack", "pipoca de microondas", "coco seco", "banana chips", "chips de batata doce",
    ],
    "Snacks",
  ],
  [
    [
      "whey", "tofu", "seitan", "proteina", "proteina de soja", "pts", "proteina texturizada", "tempeh",
      "albumina", "colageno", "creatina", "bcaa", "hipercalorico", "proteina vegetal", "carne vegetal",
      "hamburguer vegetal", "hamburguer de soja", "soja texturizada", "grao de soja", "edamame",
      "isolado proteico", "caseina", "suplemento", "barra de proteina", "pasta de amendoim proteica",
    ],
    "Proteínas",
  ],
];

export function normalizeItemName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Singular aproximado de uma palavra já normalizada: "tomates" -> "tomate",
// "limões" (limoes) -> "limao", "pães" (paes) -> "pao", "ovos" -> "ovo",
// "legumes" -> "legume", "flores" -> "flor", "feijões" -> "feijao".
function singularize(word: string): string[] {
  const out = new Set([word]);
  if (word.endsWith("oes")) out.add(word.slice(0, -3) + "ao");
  if (word.endsWith("aes")) out.add(word.slice(0, -3) + "ao");
  if (word.endsWith("ais")) out.add(word.slice(0, -3) + "al");
  if (word.endsWith("eis")) out.add(word.slice(0, -3) + "el");
  if (word.endsWith("ns")) out.add(word.slice(0, -2) + "m");
  if (word.endsWith("res") || word.endsWith("zes") || word.endsWith("ses")) {
    out.add(word.slice(0, -2));
  }
  if (word.endsWith("s")) out.add(word.slice(0, -1));
  // diminutivos comuns: "tomatinho" -> "tomate"; "cenourinha" -> "cenoura"
  if (word.endsWith("inho")) {
    const stem = word.slice(0, -4);
    out.add(stem + "o");
    out.add(stem + "e");
  }
  if (word.endsWith("inha")) out.add(word.slice(0, -4) + "a");
  if (word.endsWith("zinho")) out.add(word.slice(0, -5));
  if (word.endsWith("zinha")) out.add(word.slice(0, -5));
  return [...out];
}

// Índice de busca: palavra-chave (já normalizada) -> categoria.
const KEYWORD_INDEX: Array<{ keyword: string; category: string; multi: boolean }> = [];
for (const [keywords, category] of CATEGORY_KEYWORDS) {
  for (const raw of keywords) {
    const keyword = normalizeItemName(raw);
    if (keyword) KEYWORD_INDEX.push({ keyword, category, multi: keyword.includes(" ") });
  }
}

/**
 * Sugere a categoria pelo nome digitado, só com o dicionário local. Devolve
 * `null` quando não reconhece (aí vale tentar a IA). Entre todas as palavras-
 * chave que batem, vence a mais específica (mais longa): "filé de salmão" cai
 * em Peixes (por "salmao") e não em Carnes (por "file"), e "óleo de coco" cai
 * em Óleos e não em Frutas (por "coco"). Palavras-chave de uma palavra só
 * batem como palavra inteira, para "sal" não casar dentro de "salsicha";
 * plurais e diminutivos são reconhecidos via singularize.
 */
export function suggestCategory(name: string): string | null {
  const normalized = normalizeItemName(name);
  if (!normalized) return null;
  const words = normalized.split(" ");
  const wordForms = new Set(words.flatMap(singularize));
  // Frase inteira com cada palavra no singular, para casar "ovos de codorna",
  // "queijos minas", "peitos de frango" com as chaves de várias palavras.
  const singularPhrases = [
    normalized,
    words.map((w) => singularize(w).slice(-1)[0] ?? w).join(" "),
    words.map((w) => singularize(w)[1] ?? w).join(" "),
  ];

  let best: { category: string; length: number } | null = null;
  for (const { keyword, category, multi } of KEYWORD_INDEX) {
    const hit = multi
      ? singularPhrases.some((p) => p.includes(keyword))
      : wordForms.has(keyword);
    if (hit && (!best || keyword.length > best.length)) {
      best = { category, length: keyword.length };
    }
  }
  return best?.category ?? null;
}

export function isValidCategory(value: unknown): value is (typeof CATEGORIES)[number] {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
