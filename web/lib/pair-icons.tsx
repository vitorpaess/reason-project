import { colors } from "./theme";

// Bullet neutro ao lado do nome do par — decorativo, não codifica
// identidade por cor (com azul já usado na série e vermelho/verde em
// status, não sobra uma 4ª cor que passe no validador de contraste/CVD
// sem colidir; o texto do label já diferencia os pares).
export function PairIcon({
  size = 6,
  muted = false,
}: {
  slug?: string;
  size?: number;
  muted?: boolean;
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-full transition-opacity"
      style={{
        width: size,
        height: size,
        backgroundColor: colors.inkSecondary,
        opacity: muted ? 0.45 : 0.85,
      }}
    />
  );
}
