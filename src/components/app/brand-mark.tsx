import Image from "next/image";

/** The RozFit logo: a rounded "R" holding a dumbbell, white on coral. */
export function BrandMark({ className = "" }: { className?: string }) {
  return <Image src="/icons/logo-r.webp" width={40} height={40} alt="" priority className={`brand-mark brand-logo ${className}`} />;
}
