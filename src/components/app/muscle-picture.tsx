import Image from "next/image";
import type { BodyRegion, FigureChoice } from "@/lib/figure";
import { REGION_LABELS } from "@/lib/figure";
import { musclePicture } from "@/lib/muscle-images";
import { BodyFigure } from "./body-figure";

interface MusclePictureProps {
  figure: FigureChoice;
  /** The muscle group to show in colour. Omit for the plain body. */
  region?: BodyRegion;
  /** Used by the drawn fallback when one picture cannot show several groups. */
  highlight?: BodyRegion[];
  className?: string;
  priority?: boolean;
}

/** The anatomy picture for a muscle group, or the drawn figure for the neutral choice. */
export function MusclePicture({ figure, region, highlight, className = "", priority = false }: MusclePictureProps) {
  const picture = musclePicture(figure, region);
  if (!picture) return <BodyFigure figure={figure} highlight={highlight ?? (region ? [region] : [])} view="both" className={className} />;
  return (
    <Image src={picture.src} width={picture.width} height={picture.height} priority={priority}
      alt={region ? `${REGION_LABELS[region]} highlighted on the body` : "Body, front and back"}
      className={`muscle-picture ${className}`} sizes="(max-width: 700px) 60vw, 320px" />
  );
}
