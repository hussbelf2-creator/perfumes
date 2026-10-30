import { useState } from "react";

interface PhotoProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  zoom?: boolean;
}

/**
 * صورة بإطار ثابت: وميض أثناء التحميل، ظهور ناعم عند الاكتمال،
 * وبديل أنيق (رسم زجاجة) إن تعذّر التحميل — فلا تظهر صورة مكسورة أبداً.
 */
export default function Photo({ src, alt, className = "", imgClassName = "", priority = false, zoom = false }: PhotoProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div className={`relative overflow-hidden bg-sand ${state === "loading" ? "shimmer" : ""} ${className}`}>
      {state !== "error" && (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={`img-muted absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-[1200ms] ease-quiet ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          } ${zoom ? "kenburns" : ""} ${imgClassName}`}
        />
      )}
      {state === "error" && (
        <div role="img" aria-label={alt} className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sand-soft to-sand">
          <svg viewBox="0 0 60 100" className="h-1/3 max-h-40 text-ink-900/15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="24" y="4" width="12" height="12" rx="1.5" />
            <rect x="27" y="16" width="6" height="8" />
            <rect x="8" y="24" width="44" height="70" rx="5" />
            <rect x="16" y="50" width="28" height="18" />
          </svg>
        </div>
      )}
      <span aria-hidden="true" className="grain absolute inset-0 pointer-events-none" />
    </div>
  );
}
