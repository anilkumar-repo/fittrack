"use client";

import { Play } from "lucide-react";
import { moveVideo, type MobilityMove } from "@/lib/mobility";

/** A trainer-picked video plays here (privacy-friendly player); otherwise a button opens a YouTube search for the move. */
export function MoveVideo({ move, compact = false }: { move: MobilityMove; compact?: boolean }) {
  const video = moveVideo(move);
  if (video.embedUrl && !compact) {
    return (
      <div className="move-video">
        <iframe src={video.embedUrl} title={`${move.name} video`} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  if (compact) return <a className="icon-button move-video-link" href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Watch a video of ${move.name}`}><Play aria-hidden="true" /></a>;
  return (
    <a className="button button-subtle move-video-button" href={video.url} target="_blank" rel="noopener noreferrer">
      <Play aria-hidden="true" /> Watch a video{video.curated ? "" : " (YouTube)"}
    </a>
  );
}
