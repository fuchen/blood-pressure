import { readFile } from 'node:fs/promises';

const key = process.env.DEEPSEEK_TEST_KEY;
if (!key) throw new Error('Set DEEPSEEK_TEST_KEY for an explicitly requested live smoke test.');
const imagePath = process.argv[2];
const cases = [
  { name: 'text-structure', content: 'Return exactly the JSON object {"systolic":128,"diastolic":82,"pulse":73}.' },
];
if (imagePath) cases.push({ name: 'vision', content: [
  { type: 'text', text: 'Read the blood pressure monitor. Return JSON with integer systolic, diastolic, pulse. Do not infer a date.' },
  { type: 'image_url', image_url: { url: `data:image/png;base64,${(await readFile(imagePath)).toString('base64')}`, detail: 'high' } },
] });
for (const scenario of cases) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(90000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' }, max_tokens: 500,
      response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return only JSON.' }, { role: 'user', content: scenario.content }] }),
  });
  if (!response.ok) { console.log(JSON.stringify({ test: scenario.name, status: response.status })); process.exitCode = 1; break; }
  const body = await response.json();
  const result = JSON.parse(body.choices[0].message.content);
  const passed = result.systolic === 128 && result.diastolic === 82 && result.pulse === 73;
  console.log(JSON.stringify({ test: scenario.name, passed, model: body.model, usage: body.usage?.total_tokens }));
  if (!passed) process.exitCode = 1;
}
