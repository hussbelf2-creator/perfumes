import { useEffect, useRef } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * تنقّل بين خطوات المعالج بالأسهم اليمنى/اليسرى، دون التدخل في الكتابة داخل الحقول
 * أو في تمرير الصفحة بالأسهم العلوية/السفلية.
 */
export function useWizardKeyboard(onForward: () => void, onBackward: () => void, enabled = true) {
  const handlers = useRef({ onForward, onBackward });
  handlers.current = { onForward, onBackward };

  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handlers.current.onForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlers.current.onBackward();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [enabled]);
}
