import { Locator, Page } from '@playwright/test';

type ResolvableLocator = string | Locator;

async function performAction(
  page: Page,
  action: 'click' | 'type' | 'fill',
  locator: ResolvableLocator,
  value?: string
): Promise<void> {
  const resolvedLocator = typeof locator === 'string'
    ? page.locator(locator)
    : locator;

  switch (action) {
    case 'click':
      await resolvedLocator.click({ timeout: 3000 });
      break;
    case 'fill':
      await resolvedLocator.fill(value || '', { timeout: 3000 });
      break;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

export default performAction;
