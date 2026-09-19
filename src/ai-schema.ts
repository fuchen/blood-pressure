import { z } from 'zod';

export const recognitionSchema = z.object({
  records: z.array(z.object({
    measuredAt: z.string().nullable(),
    systolic: z.number().int().nullable(),
    diastolic: z.number().int().nullable(),
    pulse: z.number().int().nullable(),
    arm: z.string().max(200).optional().default(''),
    medication: z.string().max(500).optional().default(''),
    symptoms: z.string().max(2000).optional().default(''),
    note: z.string().max(2000).optional().default(''),
    sourceLabel: z.string().max(500),
    uncertainties: z.array(z.string().max(500)).max(30),
  })).max(200),
  warnings: z.array(z.string().max(1000)).max(30),
});
export const assessmentSchema = z.object({
  overview: z.string().min(1).max(5000),
  trends: z.array(z.string().max(2000)).max(20),
  factors: z.array(z.string().max(2000)).max(20),
  remeasure: z.array(z.string().max(2000)).min(1).max(20),
  medicalAdvice: z.array(z.string().max(2000)).min(1).max(20),
  limitations: z.array(z.string().max(2000)).min(1).max(20),
});
export function parseAI<T>(content: string, schema: z.ZodType<T>): T {
  try { return schema.parse(JSON.parse(content)); }
  catch { throw new Error('AI 返回的结构不完整或格式无效，请重试；未保存任何识别记录。'); }
}
export type Recognition = z.infer<typeof recognitionSchema>;
