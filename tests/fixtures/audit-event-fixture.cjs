'use strict';
// Synthetic capture/target/bubble model for closed Shadow DOM. It checks event
// routing, not browser editing defaults, selection layout, IME or extensions.
const { environment } = require('./audit-dom-fixture.cjs');
function eventEnvironment(options = {}) {
  const listeners = new WeakMap();
  const add = (target, type, fn, config) => {
    let byType = listeners.get(target); if (!byType) listeners.set(target, byType = new Map());
    const list = byType.get(type) || []; byType.set(type, list);
    list.push({ fn, capture: config === true || !!config?.capture });
  };
  const wrap = (target, proto = false) => {
    const original = target.addEventListener;
    target.addEventListener = function (type, fn, config) { add(proto ? this : target, type, fn, config); original.call(this, type, fn, config); };
  };
  const e = environment({ ...options, beforeRun(ctx) {
    wrap(ctx.win); wrap(ctx.document); wrap(ctx.Node.prototype, true);
    options.beforeRun?.(ctx);
  } });
  const dispatch = (target, type, details = {}, defaultAction) => {
    const path = [target]; while (path.at(-1).parentNode) path.push(path.at(-1).parentNode);
    if (target !== e.win && !path.includes(e.document)) path.push(e.document);
    if (!path.includes(e.win)) path.push(e.win);
    const shadowIndex = path.findIndex(n => n.host), shadow = path[shadowIndex];
    let currentIndex = 0, stopped = false, immediate = false;
    const event = { type, bubbles: true, composed: true, cancelable: true, defaultPrevented: false, ...details,
      get target() { return shadow && currentIndex > shadowIndex ? shadow.host : target; },
      composedPath() { return shadow && currentIndex > shadowIndex ? path.slice(shadowIndex + 1) : [...path]; },
      preventDefault() { if (this.cancelable) this.defaultPrevented = true; },
      stopPropagation() { stopped = true; }, stopImmediatePropagation() { stopped = true; immediate = true; }
    };
    const invoke = (index, capture) => {
      currentIndex = index; event.currentTarget = path[index]; event.eventPhase = index === 0 ? 2 : capture ? 1 : 3; immediate = false;
      for (const handler of listeners.get(path[index])?.get(type) || []) {
        if (handler.capture === capture) handler.fn.call(path[index], event);
        if (immediate) break;
      }
    };
    for (let i = path.length - 1; i > 0 && !stopped; i--) invoke(i, true);
    if (!stopped) { invoke(0, true); if (!immediate) invoke(0, false); }
    if (event.bubbles) for (let i = 1; i < path.length && !stopped; i++) invoke(i, false);
    if (!event.defaultPrevented) defaultAction?.(event);
    return event;
  };
  return { ...e, dispatch };
}
module.exports = { eventEnvironment };
