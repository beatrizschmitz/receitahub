import { useState } from "react";
import { RECIPE_ICONS, getRecipeStyle } from "@/lib/recipe-cover";

/** Campos de foto que acompanham uma receita, venha ela da IA ou do banco. */
export type RecipePhoto = {
  image_url?: string | null;
  image_photographer?: string | null;
  image_photographer_url?: string | null;
};

type CoverVariant = "card" | "modal" | "solo";

/**
 * Capa da receita: foto real quando existe, ícone quando não.
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
  variant = "card",
  children,
}: {
  title?: string | null;
  category?: string | null;
  ingredients?: string[] | null;
  imageUrl?: string | null;
  /** proporção ou altura do container: "aspect-[4/3]", "h-56", "aspect-[4/5]" */
  className?: string;
  variant?: CoverVariant;
  children?: React.ReactNode;
}) {
  const { icon, bg } = getRecipeStyle(title, category, ingredients);
  const Icon = RECIPE_ICONS[icon];
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
          {/* Um ícone só, em traço fino e discreto: substitui o trio de emojis,
              que puxava a interface para um tom casual demais. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              strokeWidth={1}
              className={
                variant === "modal"
                  ? "h-20 w-20 text-cream/25"
                  : variant === "solo"
                    ? "h-16 w-16 text-cream/25"
                    : "h-14 w-14 text-cream/25"
              }
            />
          </div>
        </>
      )}
      {children}
    </div>
  );
}

/**
 * Crédito ao fotógrafo, exigido pelos termos de uso da API do Pexels sempre que
 * a foto é exibida. Some quando a capa é ícone.
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
