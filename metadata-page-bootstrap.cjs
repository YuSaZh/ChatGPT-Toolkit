'use strict';
// Inject only the self-contained, unprivileged display runtime. The DOM channel
// carries fixed statuses and display/reset commands, never GM data or messages.
function startPageMetadataBridge(win, doc, { runtimeSource, transformerSource, enabled = true, changed = () => {}, key } = {}) {
  key ||= '__chatgptToolkitMetadata_' + Math.random().toString(36).slice(2);
  const statusId = key + '_status', eventName = key + '_control';
  let started = false, done = false, attempts = 0, observer, timer, status, source, lastAttempt;
  const pendingResets = [];
  const mark = (name, value) => { try { status?.setAttribute('data-' + name, String(value)); } catch {} };
  const checked = () => status?.getAttribute('data-page') === 'ready';
  const inspect = () => {
    const names = ['page','hook','runtime','registry','patch','react','enabled','mapping','renderer','labels','factories','rows','bootstrap','account','account-fence'];
    const result = {};
    const labels = new Set(['ready','on','off','installed','not-active','found','not-started','waiting-document','no-page-ack','needs-refresh-or-page-access','not-seen-refresh','failed','unsupported','ambiguous','needs-refresh','page-compile-failed','blocked','paused-account']);
    for (const name of names) { const value = status?.getAttribute('data-' + name) || (name === 'bootstrap' ? 'waiting-document' : 'not-started'); result[name] = /^(?:0|[1-9][0-9]{0,8})$/.test(value) || labels.has(value) ? value : 'unsupported'; }
    return result;
  };
  const event = command => {
    if (!status) return;
    try { doc.dispatchEvent(new win.CustomEvent(eventName, { detail: command })); } catch {}
  };
  function acknowledge() {
    for (const command of pendingResets.splice(0)) event(command);
    done = true; started = true; mark('bootstrap','ready'); observer?.disconnect(); clearTimeout(timer); changed();
  }
  function attempt() {
    if (done || checked()) { if (checked()) { acknowledge(); } return; }
    const parent = doc.head || doc.documentElement;
    if (!parent) return;
    if (!status) {
      status = doc.createElement('meta'); status.id = statusId; status.setAttribute('name','chatgpt-toolkit-message-runtime');
      parent.appendChild(status);
    }
    const nonce = doc.currentScript?.nonce || doc.querySelector('script[nonce]')?.nonce || '';
    // One immediate attempt supports pages without CSP; when a nonce appears,
    // retry before deferred application bundles. Never wait only for DOM ready.
    const signature = nonce || 'without-nonce';
    if (lastAttempt === signature || attempts >= 3) return;
    lastAttempt = signature; attempts++;
    source ||= '(' + runtimeSource + ')(' + JSON.stringify({ key,statusId,eventName,enabled }) + ',(' + transformerSource + '));';
    const script = doc.createElement('script'); if (nonce) script.nonce = nonce;
    try { script.textContent = source; parent.appendChild(script); }
    catch { mark('bootstrap','blocked'); }
    finally { script.remove(); }
    if (checked()) { acknowledge(); }
    else mark('bootstrap','no-page-ack');
  }
  try {
    observer = new win.MutationObserver(() => { attempt(); if (started) changed(); });
    observer.observe(doc, { childList: true, subtree: true });
  } catch {}
  attempt();
  if (!done) timer = win.setTimeout(() => { done = true; observer?.disconnect(); mark('bootstrap', checked() ? 'ready' : 'needs-refresh-or-page-access'); changed(); }, 15000);
  return {
    inspect,
    active: () => checked() && Number(status?.getAttribute('data-renderer')) > 0,
    setEnabled(value) { enabled = !!value; source = null; event(enabled ? 'on' : 'off'); },
    invalidate(reason) {
      const kind = reason?.startsWith('request:') ? reason.slice(8) : reason;
      const fixed = kind === 'session' || kind === 'read' ? kind : 'invalidate';
      if (checked()) event(reason?.startsWith('request:') ? 'request-' + fixed : fixed);
      else if (fixed === 'invalidate') { pendingResets.length = 0; pendingResets.push('invalidate'); }
      else if (!pendingResets.length) pendingResets.push(fixed);
    },
    route() { event('route'); },
    destroy() { done = true; observer?.disconnect(); clearTimeout(timer); event('invalidate'); status?.remove(); }
  };
}
module.exports = { startPageMetadataBridge };
