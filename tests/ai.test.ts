import { afterEach, describe, expect, it, vi } from 'vitest';
import { assessmentSchema, parseAI, recognitionSchema } from '../src/ai-schema';

vi.mock('../src/storage', () => ({ readKey: vi.fn(async () => 'test-placeholder-key'), newId: () => 'candidate-test' }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: vi.fn(), cacheDirectory: 'file:///cache/' }));
vi.mock('expo-image-manipulator', () => ({}));
import { completion } from '../src/ai';
import { recognitionCandidates, runBatch } from '../src/importing';
import { readKey } from '../src/storage';

const raw = { records: [{ measuredAt: null, systolic: 120, diastolic: 80, pulse: null, sourceLabel: '第一条', uncertainties: ['时间模糊'] }], warnings: [] };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.mocked(readKey).mockResolvedValue('test-placeholder-key'); });
describe('结构化AI数据', () => {
  it('备份批次离线恢复，保留原始时间和缺失字段供核对', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const data = { measuredAt: '2025-01-02T08:30:12.123Z', systolic: 120, diastolic: 80, pulse: null };
    const result = await runBatch({ kind: 'backup', label: '备份.xlsx', records: [data, { systolic: 130 }] }, new AbortController().signal);
    expect(result.candidates[0].data).toEqual(data);
    expect(result.candidates[1].timeConfirmed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('取消的备份批次不生成预览', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(runBatch({ kind: 'backup', label: '备份', records: [] }, controller.signal)).rejects.toThrow('取消');
  });
  it('保留缺失时间和心率，拍照预填需要用户确认', () => {
    const parsed = parseAI(JSON.stringify(raw), recognitionSchema);
    const rows = recognitionCandidates(parsed, { kind: 'image', label: '照片', uri: 'file:///cache/photo.jpg', cameraTime: '2026-09-19T08:00:00.000Z' });
    expect(rows[0].timeConfirmed).toBe(false);
    expect(rows[0].data.pulse).toBeNull();
    expect(rows[0].data.measuredAt).toBe('2026-09-19T08:00:00.000Z');
  });
  it('相册缺失时间不推测当前时间', () => {
    const rows = recognitionCandidates(recognitionSchema.parse(raw), { kind: 'image', label: '照片', uri: 'image' });
    expect(rows[0].data.measuredAt).toBe('');
  });
  it('拒绝格式损坏、数值字符串和不完整评估', () => {
    expect(() => parseAI('```json {} ```', recognitionSchema)).toThrow();
    expect(() => recognitionSchema.parse({ ...raw, records: [{ ...raw.records[0], systolic: '120' }] })).toThrow();
    expect(() => assessmentSchema.parse({ overview: '正常' })).toThrow();
  });
  it('缺失Key不发起网络请求', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(completion('JSON', 'hello', recognitionSchema)).rejects.toThrow('设置');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([[401, '无效'], [402, '余额不足'], [413, '过大']])('错误 %s 有可操作提示', async (code, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: code })));
    await expect(completion('JSON', 'hello', recognitionSchema)).rejects.toThrow(message);
  });
  it('限流只做有界重试', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429 })); vi.stubGlobal('fetch', fetchMock);
    const assertion = expect(completion('JSON', 'hello', recognitionSchema)).rejects.toThrow('频繁');
    await vi.runAllTimersAsync(); await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('输出截断拒绝入库，取消不发请求', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(raw) } }] }))); vi.stubGlobal('fetch', fetchMock);
    await expect(completion('JSON', 'hello', recognitionSchema)).rejects.toThrow('不完整');
    const controller = new AbortController(); controller.abort();
    await expect(completion('JSON', 'hello', recognitionSchema, controller.signal)).rejects.toThrow('取消');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
