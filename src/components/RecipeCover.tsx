import { useState } from "react";
import { getRecipeStyle } from "@/lib/recipe-emoji";

/** Campos de foto que acompanham uma receita, venha ela da IA ou do banco. */
export type RecipePhoto = {
  image_url?: string | null;
  image_photographer?: string | null;
  image_photographer_url?: string | null;
};

type EmojiLayout = "card" | "modal" | "solo";

/**
 * Capa da receita: foto real quando existe, emoji quando não.
 *
 * O fallback cobre três casos — o Pexels não achou nada, a busca falhou (limite
 * de requisições, rede) ou a URL guardada morreu, pego no onError do <img>.
 */
export function RecipeCover({
  title,
  category,
  ingredients,
  imageUrl,
  className = "aspect-[4/3]",
  emoji = "card",
  children,
}: {
  title?: string | null;
  category?: string | null;
  ingredients?: string[] | null;
  imageUrl?: string | null;
  /** proporção ou altura do container: "aspect-[4/3]", "h-56", "aspect-[4/5]" */
  className?: string;
  emoji?: EmojiLayout;
  children?: React.ReactNode;
}) {
  const { emojis, bg } = getRecipeStyle(title, category, ingredients);
  const chars = Array.from(emojis);
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(imageUrl) && !broken;

  return (
    <div
      className={`${className} w-full relative overflow-hidden ${
        showPhoto ? "bg-charcoal" : `bg-gradient-to-br ${bg}`
      }`}
    >
      {showPhoto ? (
        <img
          src={imageUrl!}
          alt={title ?? "Foto da receita"}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-charcoal/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            {emoji === "modal" ? (
              <div className="flex items-center justify-center gap-3 select-none drop-shadow-lg">
                {chars.map((c, i) => (
                  <span key={i} className={i === 0 ? "text-8xl" : "text-5xl opacity-80"}>
                    {c}
                  </span>
                ))}
              </div>
            ) : emoji === "solo" ? (
              <span className="text-7xl select-none drop-shadow-lg">{chars[0]}</span>
            ) : (
              <div className="relative select-none drop-shadow-lg">
                <span className="text-6xl">{chars[0]}</span>
                {chars[1] && (
                  <span className="absolute -top-2 -right-6 text-3xl opacity-80 rotate-12">
                    {chars[1]}
                  </span>
                )}
                {chars[2] && (
                  <span className="absolute -bottom-2 -left-6 text-3xl opacity-80 -rotate-12">
                    {chars[2]}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {children}
    </div>
  );
}

/**
 * Crédito ao fotógrafo, exigido pelos termos de uso da API do Pexels sempre que
 * a foto é exibida. Some quando a capa é emoji.
 */
export function RecipePhotoCredit({
  imageUrl,
  photographer,
  photographerUrl,
  className = "",
}: {
  imageUrl?: string | null;
  photographer?: string | null;
  photographerUrl?: string | null;
  className?: string;
}) {
  if (!imageUrl || !photographer) return null;

  const link = "underline decoration-cream/20 underline-offset-2 hover:text-blush transition";
  return (
    <p className={`text-[11px] text-cream/40 ${className}`}>
      Foto de{" "}
      {photographerUrl ? (
        <a href={photographerUrl} target="_blank" rel="noopener noreferrer" className={link}>
          {photographer}
        </a>
      ) : (
        photographer
      )}{" "}
      no{" "}
      <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className={link}>
        Pexels
      </a>
    </p>
  );
}
