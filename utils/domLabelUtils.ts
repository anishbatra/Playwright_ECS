import { JSDOM } from 'jsdom';

export function extractLabelHint(html: string, failedSelector: string): string {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const failedElement = failedSelector
      ? document.querySelector(failedSelector)
      : null;

    // CASE 1: Try direct label, placeholder, or aria-label
    if (failedElement) {
      const id = failedElement.getAttribute('id');
      const placeholder = failedElement.getAttribute('placeholder');
      const ariaLabel = failedElement.getAttribute('aria-label');

      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }

      if (placeholder) return placeholder.trim();
      if (ariaLabel) return ariaLabel.trim();

      const parentLabel = failedElement.closest('label');
      if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();
    }

    // CASE 2: Improved heuristics — look for meaningful input labels
    const strongKeywords = /property|code|search|email|username|login|user|account/i;

    const labelCandidates = Array.from(
      document.querySelectorAll('label, input, textarea, [aria-label], [placeholder]')
    )
      .map(el =>
        el.textContent?.trim() ||
        el.getAttribute('placeholder')?.trim() ||
        el.getAttribute('aria-label')?.trim() ||
        ''
      )
      .filter(text => text && strongKeywords.test(text));

    if (labelCandidates.length > 0) {
      return labelCandidates[0];
    }

    // CASE 3: Fallback – look for closest text-containing label near the failedSelector
    const closestLabel = failedElement?.closest('div')?.querySelector('label');
    if (closestLabel?.textContent?.trim()) return closestLabel.textContent.trim();

    return '';
  } catch (err) {
    console.error(`❌ extractLabelHint error: ${err}`);
    return '';
  }
}
