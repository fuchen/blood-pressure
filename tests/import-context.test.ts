import { afterEach, describe, expect, it, vi } from 'vitest';
import { importContext } from '../src/import-context';

vi.mock('../src/storage', () => ({ readKey: vi.fn(async () => process.env.DEEPSEEK_TEST_KEY ?? 'test-placeholder-key'), newId: () => 'context-test' }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: vi.fn(async () => undefined), cacheDirectory: 'file:///cache/' }));
vi.mock('expo-image-manipulator', () => ({ manipulateAsync: vi.fn(async () => ({ uri: 'file:///cache/converted.jpg', base64: 'synthetic-image' })), SaveFormat: { JPEG: 'jpeg' } }));

import { recognizeTable } from '../src/ai';
import { runBatch } from '../src/importing';

const recognized = { records: [{ measuredAt: '2025-09-19 08:00', systolic: 128, diastolic: 82, pulse: 73, sourceLabel: '第2行', uncertainties: [], note: '年份按用户指定的 2025 年补全' }], warnings: [] };
const table = { sheet: '记录', headerContext: [['日期', '血压']], rows: [{ row: 2, cells: ['9/19 08:00', '128/82'] }] };
function mockResponse() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(recognized) } }] })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

describe('智能导入补充信息', () => {
  it('不默认套用当前年份，清理输入空格', () => {
    expect(importContext('', '  月/日格式  ')).toEqual({ defaultYear: undefined, instructions: '月/日格式' });
    expect(importContext('2025', '')).toEqual({ defaultYear: 2025, instructions: '' });
  });
  it.each(['25', '202a', '1899', '2101', '2025.5'])('拒绝非法年份 %s', value => {
    expect(() => importContext(value, '')).toThrow('四位年份');
  });
  it('限制说明长度', () => expect(() => importContext('', '年'.repeat(2001))).toThrow('2000'));
  it('Excel 每批携带上下文，补全年份后仍保留预览备注', async () => {
    const fetchMock = mockResponse();
    const context = importContext('2025', '日期按月/日排列');
    const result = await runBatch({ kind: 'table', label: '记录', table }, new AbortController().signal, context);
    const request = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.parse(request.messages[1].content)).toEqual({ importContext: context, table });
    expect(request.messages[0].content).toContain('来源中明确的日期、年份、时间和数值优先');
    expect(request.messages[0].content).toContain('不能据此补造缺失的时分');
    expect(result.candidates[0].timeConfirmed).toBe(true);
    expect(result.candidates[0].data.note).toContain('2025');
  });
  it('图片识别也携带同样的默认年份和说明', async () => {
    const fetchMock = mockResponse();
    await runBatch({ kind: 'image', label: '图片', uri: 'file:///cache/input.png' }, new AbortController().signal, importContext('2024', '左列为收缩压'));
    const request = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(request.messages[1].content[0].text).toContain('"defaultYear":2024');
    expect(request.messages[1].content[0].text).toContain('左列为收缩压');
    expect(request.messages[1].content[1].type).toBe('image_url');
  });
  it('重试可使用修正后的说明，不污染之后的请求', async () => {
    const fetchMock = mockResponse();
    await recognizeTable(table, undefined, importContext('2024', '旧说明'));
    await recognizeTable(table, undefined, importContext('2025', '修正说明'));
    await recognizeTable(table);
    const requests = fetchMock.mock.calls.map(call => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
    expect(JSON.parse(requests[1].messages[1].content).importContext).toEqual({ defaultYear: 2025, instructions: '修正说明' });
    expect(JSON.parse(requests[2].messages[1].content).importContext).toEqual({ defaultYear: null, instructions: '' });
  });
});

it.skipIf(!process.env.DEEPSEEK_TEST_KEY)('真实模型按默认年份补缺，保留原年份，不编造缺失时间', async () => {
  const result = await recognizeTable({ sheet: '合成测试', headerContext: [['日期', '血压', '心率']], rows: [
    { row: 2, cells: ['12/31 08:00', '128/82', 73] },
    { row: 3, cells: ['2024-01-02 09:00', '125/80', 70] },
    { row: 4, cells: ['03/05', '130/85', 72] },
  ] }, undefined, importContext('2025', '日期按月/日排列；没有时间的记录不要补造时分'));
  expect(result.records).toHaveLength(3);
  expect(result.records.find(record => record.systolic === 128)?.measuredAt).toBe('2025-12-31 08:00');
  expect(result.records.find(record => record.systolic === 128)?.note).toContain('2025');
  expect(result.records.find(record => record.systolic === 125)?.measuredAt).toBe('2024-01-02 09:00');
  expect(result.records.find(record => record.systolic === 130)?.measuredAt).toBeNull();
}, 120000);
