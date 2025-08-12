import { getSuggestedLocator } from '../utils/aiLocatorHelper';
import performAction from '../utils/performAction';
import { extractLabelHint } from '../utils/domLabelUtils';
import { Locator } from '@playwright/test';

type ResolvableLocator = string | Locator;


export type ActionStep = {
  action: 'click' | 'fill';
  locator: ResolvableLocator;
  value?: string;
  role: 'username'  | 'password' | 'submit' | 'generic';
};
export type ActionStepResult = {
  originalFailed: boolean;
  fallbackUsed: boolean;
  success: boolean;
  locatorUsed: string;
  reason?: string;
};

export async function selfHealFlow(page: any, steps: ActionStep[]): Promise<ActionStepResult[]> {
  const results: ActionStepResult[] = [];

  for (const step of steps) {
    const { action, locator, value, role } = step;

    let locatorAsString: string;

    if (typeof locator === 'string') {
      locatorAsString = locator;
    } else {
      try {
        const handle = await locator.evaluateHandle(el => el);
        locatorAsString = await locator.evaluate(el => el.outerHTML);
        await handle.dispose(); // clean up
      } catch {
        locatorAsString = `[Unresolved Locator: ${role}]`;
      }
    }
    


    let stepResult: ActionStepResult = {
      originalFailed: false,
      fallbackUsed: false,
      success: false,
      locatorUsed: locatorAsString,
    };

    try {
      await performAction(page, action, locator, value);
      stepResult.success = true;
    } catch (error) {
      stepResult.originalFailed = true;

      const html = await page.content();
      const labelHint = extractLabelHint(html, typeof locator === 'string' ? locator : '');

      const suggestions = await getSuggestedLocator(html, locatorAsString, action, role, labelHint);

      for (const suggestion of suggestions) {
        const cleaned = suggestion.trim().replace(/^["'`]+|["'`]+$/g, '');
        if (!cleaned) continue;

        try {
          const resolvedLocator = cleaned.startsWith('//')
            ? page.locator(`xpath=${cleaned}`)
            : page.locator(cleaned);

          const tag = await resolvedLocator.evaluate((el: Element) => el.tagName.toLowerCase());
          const typeAttr = (await resolvedLocator.getAttribute('type'))?.toLowerCase() || '';
          const nameAttr = (await resolvedLocator.getAttribute('name'))?.toLowerCase() || '';
          const idAttr = (await resolvedLocator.getAttribute('id'))?.toLowerCase() || '';

          // Heuristics
          if (role === 'username' && typeAttr === 'password') continue;
          if (role === 'password' && typeAttr !== 'password') continue;
          if (role === 'username' && !(nameAttr.includes('user') || idAttr.includes('user'))) continue;
          if (role === 'submit') {
            const isValid = tag === 'button' || (tag === 'input' && ['submit', 'button'].includes(typeAttr));
            if (!isValid) continue;
          }

          console.log(`🟢 Trying fallback: ${cleaned}`);
          await performAction(page, action, resolvedLocator, value);

          stepResult.success = true;
          stepResult.fallbackUsed = true;
          stepResult.locatorUsed = cleaned;
          break;
        } catch (fallbackError) {
          console.warn(`Fallback failed: ${cleaned}`);
        }
      }

      if (!stepResult.success) {
        stepResult.reason = `All fallback attempts failed for '${action}' on role '${role}'`;
      }
    }

    results.push(stepResult);
  }

  return results;
}

export async function validateSelfHealingFlow(results: any){
     // Fail test if any step failed
     const failedSteps = results.filter((r: { success: any; }) => !r.success);
     if (failedSteps.length > 0) {
       console.error('One or more steps failed:', failedSteps);
       throw new Error('Self-healing login flow failed.');
     }
     //To make test failures clear, logging this:
     results.forEach((step: { success: any; reason: any; locatorUsed: any; }, index: number) => {
       if (!step.success) {
         console.error(
           `Step ${index + 1} failed: ${step.reason || 'unknown error'} | Locator used: ${step.locatorUsed}`
         );
       }
     });
 
     console.log('Self-healing login test passed successfully with fallbacks:', results);
}

  
