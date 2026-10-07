// spec: docs/specs/dev-server.md, Live reload

/**
 * The script a served page carries, held as a string so the compiled
 * package carries it without a second file. It connects to the session's
 * event stream and shows a build's status in elements it creates once.
 */
const script = `(() => {
  const status = document.createElement('div');
  status.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:2147483647;display:none;padding:.5rem 1rem;border-radius:4px;background:#222;color:#fff;font:14px system-ui,sans-serif';
  status.textContent = 'Building…';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;overflow:auto;padding:2rem;background:rgba(0,0,0,.85);color:#fff';
  const report = document.createElement('pre');
  report.style.cssText = 'margin:0;white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace';
  overlay.append(report);
  (document.body || document.documentElement).append(status, overlay);
  const events = new EventSource('/_underdot/events');
  events.addEventListener('building', () => {
    overlay.style.display = 'none';
    status.style.display = 'block';
  });
  events.addEventListener('failed', (event) => {
    status.style.display = 'none';
    report.textContent = event.data;
    overlay.style.display = 'block';
  });
  events.addEventListener('built', () => {
    location.reload();
  });
})();`;

/**
 * The document with the session's script before its last closing body tag,
 * or appended to it when it has none.
 */
export const injectClientScript = (html: string): string => {
  const tag = `<script>${script}</script>`;
  const closing = [...html.matchAll(/<\/body>/gi)].at(-1);
  if (closing === undefined) {
    return html + tag;
  }
  return html.slice(0, closing.index) + tag + html.slice(closing.index);
};
