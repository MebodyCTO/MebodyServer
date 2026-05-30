import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  SAMPLE_QUESTION_SET,
  SAMPLE_QUESTIONS_SNAPSHOT,
  type SampleQuestion,
} from '../data/sampleQuestionsSnapshot'
import type { AnswerMap } from '../utils/sampleBodyCodeCalculator'

const USE_DB_QUESTIONS = import.meta.env.VITE_USE_SUPABASE_QUESTIONS === 'true'
const USE_DB_SUBMIT = import.meta.env.VITE_USE_SUPABASE_SUBMIT === 'true'

/** 즉시 반환 — 스냅샷만 사용 (DB는 opt-in) */
export function getSampleQuestionsSync(): SampleQuestion[] {
  return SAMPLE_QUESTIONS_SNAPSHOT
}

/** 백그라운드 DB 동기화 (선택) */
export async function fetchSampleQuestionsFromDb(): Promise<SampleQuestion[] | null> {
  if (!USE_DB_QUESTIONS || !isSupabaseConfigured || !supabase) return null

  try {
    const { data, error } = await supabase
      .from('questions')
      .select(
        'id, question_code, question_number, sort_order, axis, question_text, option_1, option_2, option_3, weight_a, weight_b, is_precheck, is_scored, is_active, question_set, media_type, media_url',
      )
      .eq('is_active', true)
      .eq('question_set', SAMPLE_QUESTION_SET)
      .order('sort_order', { ascending: true })

    if (error || !data?.length) return null
    return data.map((row) => mapQuestionRow(row as Record<string, unknown>))
  } catch {
    return null
  }
}

function mapQuestionRow(row: Record<string, unknown>): SampleQuestion {
  return {
    id: Number(row.id),
    question_code: String(row.question_code),
    question_number: Number(row.question_number ?? row.sort_order ?? 0),
    sort_order: Number(row.sort_order),
    axis: row.axis as SampleQuestion['axis'],
    axis_label: String(row.axis_label ?? ''),
    weight_a: Number(row.weight_a ?? 1),
    weight_b: Number(row.weight_b ?? 1),
    question_text: String(row.question_text),
    option_1: String(row.option_1),
    option_2: String(row.option_2),
    option_3: String(row.option_3),
    media_type: (row.media_type as SampleQuestion['media_type']) ?? 'lottie',
    media_url: String(row.media_url ?? ''),
    is_scored: row.is_scored !== false,
    is_precheck: row.is_precheck === true,
    is_active: row.is_active !== false,
    question_set: String(row.question_set ?? SAMPLE_QUESTION_SET),
  }
}

export async function submitSampleResponse(
  answers: AnswerMap,
  calculatedCode: string,
): Promise<void> {
  if (!USE_DB_SUBMIT || !isSupabaseConfigured || !supabase) return

  const payload: Record<string, unknown> = {
    answers,
    calculated_code: calculatedCode,
    status: 'completed',
    question_version: SAMPLE_QUESTION_SET,
    response_mode: 'sample',
    completed_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('questionnaire_responses').insert(payload)
  if (error) console.warn('Sample submit skipped:', error.message)
}
