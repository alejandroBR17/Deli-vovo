import { useLayoutEffect } from 'react';

let locks = 0;
let release: (() => void) | undefined;

// A fixed body also prevents background rubber-banding on mobile browsers.
// Nested dialogs share the lock and restore the original scroll only at the end.
export function useBodyScrollLock(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    if (locks++ === 0) {
      const body = document.body, root = document.documentElement;
      const x = window.scrollX, y = window.scrollY;
      const before = {position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,overflow:body.style.overflow,paddingRight:body.style.paddingRight};
      const rootOverflow = root.style.overflow, rootOverscroll = root.style.overscrollBehavior;
      const scrollbar = window.innerWidth - root.clientWidth;
      body.style.position = 'fixed'; body.style.top = `-${y}px`;
      body.style.left = '0'; body.style.right = '0'; body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
      root.style.overflow = 'hidden'; root.style.overscrollBehavior = 'none';
      release = () => {
        Object.assign(body.style, before);
        root.style.overflow = rootOverflow; root.style.overscrollBehavior = rootOverscroll;
        const behavior = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto'; window.scrollTo(x,y); root.style.scrollBehavior = behavior;
      };
    }
    return () => { if (--locks === 0) { release?.(); release = undefined; } };
  }, [open]);
}
