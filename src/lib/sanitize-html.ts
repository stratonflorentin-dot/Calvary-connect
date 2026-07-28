import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML built by interpolating DB-backed fields (customer names,
 * addresses, contract clauses, etc.) into a trusted template string before
 * it's rendered via dangerouslySetInnerHTML / document.write. Strips
 * <script>, event handlers (onerror, onclick, ...), javascript: URLs, etc.
 * while preserving the formatting markup the templates rely on.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['svg', 'path', 'circle', 'line', 'text', 'textPath', 'style'],
    ADD_ATTR: ['viewBox', 'href', 'startOffset', 'text-anchor', 'letter-spacing', 'stroke-width'],
  });
}
