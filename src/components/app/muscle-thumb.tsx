"use client";

import Image from "next/image";
import { regionsForExercises } from "@/lib/figure";
import { sidePicture, startingSide } from "@/lib/muscle-images";
import type { ExerciseDefinition } from "@/lib/types";
import { BodyFigure } from "./body-figure";
import { useFitTrack } from "./fit-track-provider";

/** A small anatomy picture of the main muscle group an exercise works, on the side where it is seen. */
export function MuscleThumb({ exercise, className = "" }: { exercise: Pick<ExerciseDefinition, "id" | "movementPattern">; className?: string }) {
  const { figure } = useFitTrack();
  const region = regionsForExercises([exercise])[0];
  const picture = sidePicture(figure, startingSide(region), region);
  if (!picture) return <BodyFigure figure={figure} highlight={region ? [region] : []} className={`muscle-thumb ${className}`} />;
  return <Image src={picture.src} width={picture.width} height={picture.height} alt="" loading="eager" sizes="64px" className={`muscle-thumb ${className}`} />;
}
