import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  BookmarkPlus,
  Check,
  Camera,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePlanGate } from "@/contexts/PlanGateContext";
import { recognizePhoto, type RecognizedPhoto } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

type Recipe = RecognizedPhoto["recipe"];

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** foto anexada pelo usuário (data URL), exibida como miniatura na conversa */
  image?: string;
  /** receita estruturada vinda do reconhecimento por foto */
  recipe?: Recipe;
  /** linha em photo_recognition_requests, para vincular a receita quando salva */
  recognitionId?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pantry-chat`;
const PHOTO_BUCKET = "pantry-photos";
const MAX_IMAGE_SIDE = 1024;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function cleanMarkdownLine(value: string) {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[`_]/g, "")
    .trim();
}

function isKnownSectionHeading(line: string) {
  const cleaned = cleanMarkdownLine(line).replace(/:$/, "").trim();
  const normalized = normalizeText(cleaned);
  return (
    cleaned.length <= 48 &&
    /^(ingredientes?|modo de preparo|preparo|como fazer|passo a passo|instrucoes?|detalhes?|tempo|rendimento|porcoes?|dificuldade|categoria|dicas?|observacoes?)$/.test(
      normalized,
    )
  );
}

function isIngredientHeading(line: string) {
  return normalizeText(cleanMarkdownLine(line)).includes("ingrediente");
}

function isInstructionHeading(line: string) {
  return /(modo de preparo|preparo|modo de fazer|como fazer|passo a passo|instrucoes?)/.test(
    normalizeText(cleanMarkdownLine(line)),
  );
}

// Detecta se a mensagem contém uma receita (tem ingredientes + modo de preparo).
// Antes disso dependia só de duas palavras-chave ("ingrediente" + "preparo"),
// o que perdia receita sempre que o chef fugia um pouco da estrutura pedida no
// prompt (ver supabase/functions/pantry-chat) — daí o botão "salvar" some às
// vezes mesmo com uma receita completa na tela. Agora usa listas de sinônimos
// bem mais largas e, se ainda assim não bater, cai para um sinal estrutural
// (lista de itens seguida de passo a passo numerado).
function detectRecipe(content: string): boolean {
  const lower = normalizeText(content);
  const hasIngredients =
    lower.includes("ingrediente") ||
    lower.includes("xicara") ||
    lower.includes("colher") ||
    lower.includes("gramas") ||
    lower.includes(" g de ") ||
    lower.includes("ml de ") ||
    lower.includes("unidade") ||
    lower.includes("dente de alho") ||
    lower.includes("pitada") ||
    lower.includes("fatia") ||
    lower.includes("a gosto");
  const hasInstructions =
    lower.includes("preparo") ||
    lower.includes("modo de fazer") ||
    lower.includes("como fazer") ||
    lower.includes("passo") ||
    lower.includes("refog") ||
    lower.includes("cozinh") ||
    lower.includes("ferv") ||
    lower.includes("misture") ||
    lower.includes("mexa") ||
    lower.includes("adicione") ||
    lower.includes("acrescente") ||
    lower.includes("junte") ||
    lower.includes("tempere") ||
    lower.includes("doure") ||
    lower.includes("frite") ||
    lower.includes("asse") ||
    lower.includes("forno") ||
    lower.includes("escorra") ||
    lower.includes("reserve") ||
    lower.includes("sirva") ||
    lower.includes("finaliz");
  if (hasIngredients && hasInstructions) return true;

  // Sinal estrutural: bloco de marcadores (ingredientes) + lista numerada
  // (passo a passo) — típico de receita mesmo sem bater nas palavras acima.
  const bulletItems = (content.match(/^\s*[-*•]\s+.+$/gm) ?? []).length;
  const numberedSteps = (content.match(/^\s*\d+[.)]\s+.+$/gm) ?? []).length;
  return bulletItems >= 3 && numberedSteps >= 2;
}

// Extrai título da receita do texto
function extractTitle(content: string): string {
  // Tenta pegar o primeiro título markdown (# ou **)
  const markdownTitle = content.match(/^#{1,3}\s+(.+)/m)?.[1];
  if (markdownTitle) return markdownTitle.trim();
  const boldTitle = content.match(/\*\*(.{5,60})\*\*/)?.[1];
  if (boldTitle) return boldTitle.trim();
  // Fallback: primeira linha não vazia
  const firstLine = content.split("\n").find((l) => l.trim().length > 3);
  return firstLine ? cleanMarkdownLine(firstLine) : "Receita do Chef";
}

// Extrai ingredientes mesmo quando o chef usa markdown, emojis ou lista numerada
function extractIngredients(content: string): string[] {
  const lines = content.split("\n");
  const ingredients: string[] = [];
  let inIngredientSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isIngredientHeading(trimmed)) {
      inIngredientSection = true;
      continue;
    }

    if (inIngredientSection && isKnownSectionHeading(trimmed)) break;

    if (inIngredientSection) {
      const cleaned = cleanMarkdownLine(trimmed);
      if (cleaned && !isKnownSectionHeading(cleaned) && cleaned.length <= 140)
        ingredients.push(cleaned);
    }
  }

  return ingredients.length > 0 ? ingredients : [];
}

// Extrai modo de preparo
function extractInstructions(content: string): string {
  const lines = content.split("\n");
  const steps: string[] = [];
  let inInstructionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isInstructionHeading(trimmed)) {
      inInstructionSection = true;
      const inlineStep = cleanMarkdownLine(trimmed)
        .replace(
          /^(modo de preparo|preparo|modo de fazer|como fazer|passo a passo|instruções?)\s*:?\s*/i,
          "",
        )
        .trim();
      if (inlineStep) steps.push(inlineStep);
      continue;
    }

    if (inInstructionSection && isKnownSectionHeading(trimmed)) break;
    if (inInstructionSection) steps.push(cleanMarkdownLine(trimmed));
  }

  return steps.length > 0 ? steps.join("\n") : content.trim();
}

function extractTimeMinutes(content: string): number | null {
  const hourMatch = normalizeText(content).match(/(\d+(?:[,.]\d+)?)\s*(?:h|hora|horas)\b/);
  const minuteMatch = normalizeText(content).match(/(\d{1,3})\s*(?:min|minuto|minutos)\b/);
  const hours = hourMatch ? Number(hourMatch[1].replace(",", ".")) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = hours + minutes;
  return total > 0 ? Math.round(total) : null;
}

function extractDifficulty(content: string): string | null {
  const lower = normalizeText(content);
  if (lower.includes("dificil")) return "difícil";
  if (lower.includes("medio")) return "médio";
  if (lower.includes("facil")) return "fácil";
  return null;
}

function extractDiet(content: string): string[] {
  const lower = normalizeText(content);
  const diets = [
    ["sem gluten", "sem glúten"],
    ["sem lactose", "sem lactose"],
    ["vegetariano", "vegetariano"],
    ["vegano", "vegano"],
    ["low carb", "low carb"],
  ];
  return diets.filter(([needle]) => lower.includes(needle)).map(([, label]) => label);
}

function extractCategory(content: string): string {
  const match = content.match(/categoria\s*:\s*([^\n]+)/i);
  return match ? cleanMarkdownLine(match[1]).toLowerCase() : "prato principal";
}

function extractCalories(content: string): number | null {
  // Procura padrões tipo "320 kcal", "≈ 450 kcal", "calorias: 380", "380 calorias"
  const patterns = [
    /(\d{2,4})\s*kcal/i,
    /calorias?\s*[:\-–]?\s*(\d{2,4})/i,
    /(\d{2,4})\s*calorias?/i,
  ];
  for (const re of patterns) {
    const m = content.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 30 && n <= 3000) return n;
    }
  }
  return null;
}

function extractCost(content: string, kind: "home" | "delivery"): number | null {
  // Padrão preferido: "R$ 18 em casa vs R$ 45 no delivery"
  const dual = content.match(
    /r\$\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*em\s*casa[^\d]*r\$\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
  );
  if (dual) {
    const n = parseFloat((kind === "home" ? dual[1] : dual[2]).replace(",", "."));
    if (!isNaN(n) && n > 0 && n < 1000) return n;
  }
  return null;
}

function extractDescription(content: string, title: string): string {
  const titleNormalized = normalizeText(title);
  const line = content
    .split("\n")
    .map(cleanMarkdownLine)
    .find(
      (item) =>
        item.length >= 24 &&
        item.length <= 180 &&
        !isKnownSectionHeading(item) &&
        normalizeText(item) !== titleNormalized,
    );
  return line ?? "Receita sugerida pelo Chef Despensa";
}

// Reduz a foto antes de mandar para a IA e para o Storage — fotos de celular
// passam de 4 MB e o gateway recusa payloads muito grandes.
async function compressImage(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = original;
  });

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
  if (scale === 1 && original.length < 1_500_000) return original;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Monta a resposta do chef a partir da receita estruturada devolvida pela IA
function recipeToMarkdown(mainItem: string, recipe: Recipe): string {
  const parts: string[] = [];
  parts.push(mainItem ? `Identifiquei **${mainItem}** na foto!` : "Olha o que dá pra fazer!");
  parts.push(`### ${recipe.title}`);
  if (recipe.description) parts.push(recipe.description);

  const meta: string[] = [];
  if (recipe.time_minutes) meta.push(`⏱ ${recipe.time_minutes} min`);
  if (recipe.difficulty) meta.push(`${recipe.difficulty}`);
  if (recipe.category) meta.push(`${recipe.category}`);
  if (meta.length > 0) parts.push(meta.join(" — "));

  if (recipe.ingredients?.length) {
    parts.push(["**Ingredientes**", ...recipe.ingredients.map((i) => `- ${i}`)].join("\n"));
  }
  if (recipe.instructions) {
    parts.push(["**Modo de preparo**", recipe.instructions].join("\n"));
  }

  const nutrition: string[] = [];
  if (recipe.calories_per_serving) nutrition.push(`${recipe.calories_per_serving} kcal por porção`);
  if (recipe.diet?.length) nutrition.push(recipe.diet.join(", "));
  if (nutrition.length > 0) {
    parts.push(["**Informações nutricionais**", nutrition.join(" — ")].join("\n"));
  }

  if (recipe.cost_home_brl && recipe.cost_delivery_brl) {
    parts.push(`R$ ${recipe.cost_home_brl} em casa vs R$ ${recipe.cost_delivery_brl} no delivery`);
  }

  return parts.join("\n\n");
}

export function PantryChat() {
  const { user } = useAuth();
  const { tier, canChat, chatLimit, chatRemaining, registerChatMessage } = useSubscription();
  const { requireFeature } = usePlanGate();
  const runRecognize = useServerFn(recognizePhoto);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedMsgIndexes, setSavedMsgIndexes] = useState<Set<number>>(new Set());
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        'Oi! Sou seu chef virtual. Posso ver sua despensa e sugerir o que cozinhar. Me pergunta algo como **"o que posso fazer no almoço?"**',
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function fetchPantry() {
    if (!user) return [];
    const { data, error } = await supabase
      .from("pantry_items")
      .select("name, quantity, category")
      .eq("user_id", user.id);
    if (error) {
      console.error("pantry fetch", error);
      return [];
    }
    return data ?? [];
  }

  // Guarda a foto no Storage privado do usuário. Falha aqui não impede a receita:
  // o reconhecimento continua registrado, apenas sem a imagem vinculada.
  async function uploadPhoto(dataUrl: string): Promise<string | null> {
    if (!user) return null;
    try {
      const blob = dataUrlToBlob(dataUrl);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: blob.type });
      if (error) {
        console.error("upload foto", error);
        return null;
      }
      return path;
    } catch (e) {
      console.error("upload foto", e);
      return null;
    }
  }

  async function pickPhoto() {
    if (!requireFeature("foto")) return;
    fileRef.current?.click();
  }

  async function handleFile(file: File) {
    if (file.size > 8_000_000) {
      toast.error("Imagem muito grande (máx 8 MB).");
      return;
    }
    try {
      setAttachment(await compressImage(file));
    } catch (e) {
      console.error(e);
      toast.error("Não consegui ler essa imagem.");
    }
  }

  async function saveRecipe(msgIndex: number) {
    if (!user) return;
    const msg = messages[msgIndex];
    if (!msg?.content) return;

    // Receita vinda da foto já chega estruturada; a do chat em texto é extraída do markdown
    const structured = msg.recipe;
    const content = msg.content;
    const title = structured?.title ?? extractTitle(content);
    const ingredients = structured ? (structured.ingredients ?? []) : extractIngredients(content);

    const { data: saved, error } = await supabase
      .from("user_recipes")
      .insert({
        user_id: user.id,
        title,
        description: structured
          ? (structured.description ?? null)
          : extractDescription(content, title),
        category: structured
          ? (structured.category ?? "prato principal")
          : extractCategory(content),
        time_minutes: structured ? (structured.time_minutes ?? null) : extractTimeMinutes(content),
        difficulty: structured ? (structured.difficulty ?? null) : extractDifficulty(content),
        ingredients: ingredients.length > 0 ? ingredients : null,
        instructions: structured ? (structured.instructions ?? null) : extractInstructions(content),
        diet: structured ? (structured.diet ?? []) : extractDiet(content),
        calories_per_serving: structured
          ? (structured.calories_per_serving ?? null)
          : extractCalories(content),
        cost_home_brl: structured
          ? (structured.cost_home_brl ?? null)
          : extractCost(content, "home"),
        cost_delivery_brl: structured
          ? (structured.cost_delivery_brl ?? null)
          : extractCost(content, "delivery"),
        is_favorite: false,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error("Erro ao salvar a receita.");
      return;
    }

    // Vincula a receita ao reconhecimento que a originou
    if (saved?.id && msg.recognitionId) {
      const { data: linked, error: linkError } = await supabase
        .from("photo_recognition_requests")
        .update({ generated_recipe_id: saved.id })
        .eq("id", msg.recognitionId)
        .select("id");
      // 0 linhas aqui costuma significar policy de UPDATE ausente (ver migration)
      if (linkError || linked?.length === 0)
        console.error("vincular receita à foto", linkError ?? "nenhuma linha atualizada");
    }

    setSavedMsgIndexes((prev) => new Set(prev).add(msgIndex));
    toast.success(`"${title}" salva em Minhas Receitas.`);
  }

  // Fluxo da foto: reconhece o prato, registra e devolve a receita no chat
  async function sendPhoto(text: string) {
    if (!user || !attachment) return;
    if (!requireFeature("foto")) return;

    const image = attachment;
    setInput("");
    setAttachment(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text || "O que consigo cozinhar com isso?", image },
    ]);
    setLoading(true);

    try {
      const pantry = await fetchPantry();
      const recognized = await runRecognize({
        data: { image, pantry: pantry.map((p) => p.name) },
      });

      const storedPath = await uploadPhoto(image);
      const { data: request, error: requestError } = await supabase
        .from("photo_recognition_requests")
        .insert({
          user_id: user.id,
          image_url: storedPath,
          recognized_item: recognized.main_item || null,
        })
        .select("id")
        .maybeSingle();
      if (requestError) console.error("registrar reconhecimento", requestError);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: recipeToMarkdown(recognized.main_item, recognized.recipe),
          recipe: recognized.recipe,
          recognitionId: request?.id,
        },
      ]);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não consegui ler a foto.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (loading) return;
    if (attachment) {
      await sendPhoto(text);
      return;
    }
    if (!text) return;
    if (!canChat) {
      toast.error(
        "Você atingiu o limite de mensagens de hoje. Assine um plano para conversar sem limites.",
      );
      return;
    }
    setInput("");
    await registerChatMessage();
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const pantry = await fetchPantry();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken =
        sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          pantry,
        }),
      });

      if (!resp.ok || !resp.body) {
        const payload = await resp.json().catch(() => null);
        if (resp.status === 429)
          toast.error(payload?.error ?? "Muitas requisições. Aguarde um momento.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error("Erro ao falar com o chef.");
        setLoading(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let accumulated = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulated += content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: accumulated };
                return copy;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão com o chef.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Abrir chat com o chef"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all hover:scale-105 active:scale-95",
          open && "scale-90",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground">
            <Sparkles className="h-2.5 w-2.5" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(580px,80vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Chef Despensa</p>
              <p className="text-[11px] opacity-80">
                {chatLimit === null
                  ? "Mensagens ilimitadas — plano " + tier
                  : `${chatRemaining} de ${chatLimit} mensagens restantes hoje`}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => {
              const isAssistant = m.role === "assistant";
              const hasRecipe = isAssistant && (Boolean(m.recipe) || detectRecipe(m.content));
              const isSaved = savedMsgIndexes.has(i);
              const isStreaming = loading && i === messages.length - 1 && isAssistant;

              return (
                <div key={i} className={cn("flex flex-col", !isAssistant && "items-end")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      isAssistant
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {isAssistant ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-strong:text-foreground dark:prose-invert">
                        <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                      </div>
                    ) : (
                      <>
                        {m.image && (
                          <img
                            src={m.image}
                            alt="foto enviada"
                            className="mb-2 max-h-40 w-full rounded-xl object-cover"
                          />
                        )}
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </>
                    )}
                  </div>

                  {/* Botão salvar receita — aparece abaixo da mensagem do chef quando detecta receita */}
                  {hasRecipe && !isStreaming && (
                    <button
                      onClick={() => saveRecipe(i)}
                      disabled={isSaved}
                      className={cn(
                        "mt-1.5 flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
                        isSaved
                          ? "border-green-500/40 bg-green-500/10 text-green-400 cursor-default"
                          : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5",
                      )}
                    >
                      {isSaved ? (
                        <>
                          <Check className="h-3 w-3" /> Salva em Minhas Receitas!
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="h-3 w-3" /> Salvar esta receita
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}

            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
              </div>
            )}
          </div>

          {!canChat && (
            <div className="border-t border-border bg-blush/[0.07] px-4 py-3 text-xs text-foreground">
              Você atingiu o limite de mensagens de hoje. Assine um plano para conversar sem
              limites.{" "}
              <Link to="/planos" className="font-medium text-primary underline">
                Ver planos
              </Link>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex flex-col gap-2 border-t border-border bg-background p-3"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />

            {attachment && (
              <div className="relative w-fit">
                <img
                  src={attachment}
                  alt="pré-visualização da foto"
                  className="h-20 w-20 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label="Remover foto"
                  onClick={() => setAttachment(null)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-cream shadow border border-border transition hover:text-blush"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                size="icon-pill"
                variant="ghost"
                aria-label="Enviar uma foto do prato"
                title="Enviar foto de um prato ou ingrediente"
                onClick={() => void pickPhoto()}
                disabled={loading}
                className="shrink-0 text-muted-foreground hover:text-primary"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  attachment
                    ? "Quer dizer algo sobre a foto? (opcional)"
                    : canChat
                      ? "O que posso cozinhar hoje?"
                      : "Limite diário atingido"
                }
                disabled={loading || (!canChat && !attachment)}
                className="flex-1 rounded-full"
              />
              <Button
                type="submit"
                size="icon-pill"
                disabled={loading || (attachment ? false : !input.trim() || !canChat)}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
