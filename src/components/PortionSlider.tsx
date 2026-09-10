import type { CSSProperties } from "react";

type PortionSliderProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Números de referência abaixo da barra. */
  marks?: [number, number, number];
};

// Slider de ajuste de porções, usado no modal de receita (em /receitas e
// /minhas-receitas). Estilizado via classe global `.portion-slider` em
// styles.css — o preenchimento até o valor atual é feito com um gradiente
// que lê --range-progress, porque o WebKit não tem um pseudo-elemento nativo
// para "parte já preenchida" da trilha (o Firefox tem, via ::-moz-range-progress).
export function PortionSlider({ value, onChange, min = 1, max = 12, marks = [1, 6, 12] }: PortionSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--range-progress": `${percent}%` } as CSSProperties}
        className="portion-slider w-full"
      />
      <div className="flex justify-between text-[10px] text-cream/40 mt-3 px-0.5">
        {marks.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}
