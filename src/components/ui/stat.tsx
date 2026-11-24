/** One hero number with a label and an optional delta. */
export function Stat({ value, label, delta, size = "md" }: { value: string | number; label: string; delta?: { text: string; tone: "up" | "down" | "flat" }; size?: "md" | "lg" }) {
  return (
    <div className={`ui-stat ui-stat--${size}`}>
      <span className="ui-stat__value">{value}</span>
      <span className="ui-stat__label">{label}</span>
      {delta && <span className={`ui-stat__delta ui-stat__delta--${delta.tone}`}>{delta.text}</span>}
    </div>
  );
}
