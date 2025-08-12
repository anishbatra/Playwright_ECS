import { OpenAI } from 'openai';
const apiKey = process.env.OPENAI_API_KEY || 'YourFallbackAPIKeyHere';
if (!apiKey) {
  throw new Error('The OPENAI_API_KEY environment variable is missing or empty, and no fallback API key is provided.');
}
const openai = new OpenAI({ apiKey });

if (!process.env.OPENAI_API_KEY) {
  throw new Error('The OPENAI_API_KEY environment variable is missing or empty.');
}


export async function getSuggestedLocator(
  html: string,
  failedLocator: string,
  action: 'click' | 'fill',
  role: 'username' | 'password' | 'submit' | 'generic',
  labelHint?: string
): Promise<string[]> {
  const roleInstructions = {
    username: `
Role: Username Input Field

✅ Only suggest:
- input#username
- input[name="username"]
- input[placeholder*="username"]

❌ Do NOT suggest:
- Password fields
- Email fields
`,
    password: `
Role: Password Input Field

✅ Only suggest:
- input[type="password"]
- input#password
- input[name="password"]

❌ Do NOT suggest:
- input[type="text"]
- username/email fields
`,
    submit: `
Role: Submit/Login Button

✅ Only suggest:
- button:has-text("Login")
- input[type="submit"]
- input#kc-login

❌ Do NOT suggest:
- input[type="text"]
- username/password fields
`,
  generic: `
Role: Generic Field

✅ Suggest:
- Any css locator that matches: id, class, aria-label or Xpath that matches with: "${labelHint}"
- Any input, textarea, or searchable field (searchbox, text input)
- Match on placeholder, label, or aria-label with: "${labelHint}"

❌ Avoid:
- Hidden or disabled elements
- Password or submit-only elements
`,
  };

  const instructions = roleInstructions[role] || '';

  const prompt = `
You are an automation engineer writing robust Playwright selectors.

The original selector "${failedLocator}" failed during "${action}" on role "${role}".
Label hint: "${labelHint || 'N/A'}"

${instructions}

🧾 Output Format:
- Return only valid Playwright selectors (one per line)
- ❌ No comments, explanations, or markdown
- ✅ Just raw selector strings

📄 HTML DOM Snapshot:
${html}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  const output = response.choices[0].message?.content || '';

  const cleaned = output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((line) =>
      line
        .split(/\s+or\s+/) // handle "or" separated selectors
        .map(
          (selector) => selector.split('>>')[1]?.trim() || selector.trim() // take only RHS of >> or keep full
        )
        .map((selector) =>
          selector
            .replace(/^["'`]+|["'`]+$/g, '') // strip quotes
            .replace(/\\\"/g, '"') // unescape quotes
            .trim()
        )
    )
    .filter(
      (selector) =>
        selector &&
        !selector.startsWith('<') &&
        !selector.startsWith('role=') && // reject invalid role= selectors
        !selector.includes('undefined') &&
        (selector.startsWith('input') ||
          selector.startsWith('button') ||
          selector.startsWith('text=') ||
          selector.startsWith('label=') ||
          selector.startsWith('xpath=') ||
          selector.startsWith('css=') ||
          selector.includes('has-text') ||
          selector.includes('['))
    );

  if (cleaned.length === 0 && role === 'submit') {
    console.warn('⚠️ No suggestions returned. Using emergency fallback for submit.');
    return ['text="Sign In"', 'input[type="submit"]', 'button:has-text("Login")'];
  }

  return cleaned;
}
