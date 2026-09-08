import { api } from '@/services/api'
import { serviceError } from './errors'

export type BehaviorCategory = 'positive' | 'negative' | 'warning' | 'achievement'

export interface StudentBehavior {
  id: string
  student_id: string
  behavior_date: string
  category: BehaviorCategory
  description: string
  action_taken: string | null
  recorded_by: string | null
  created_at: string
}

export async function listBehavior(studentId: string): Promise<StudentBehavior[]> {
  const { data, error } = await api
    .from('student_behavior')
    .select('*')
    .eq('student_id', studentId)
    .order('behavior_date', { ascending: false })
  if (error) throw serviceError(error, 'Failed to load behavior records')
  return (data ?? []) as StudentBehavior[]
}

export async function addBehavior(input: {
  student_id: string
  category: BehaviorCategory
  description: string
  action_taken?: string
  recorded_by: string
}) {
  const { data, error } = await api
    .from('student_behavior')
    .insert({
      student_id: input.student_id,
      category: input.category,
      description: input.description,
      action_taken: input.action_taken || null,
      recorded_by: input.recorded_by,
    })
    .select()
    .single()
  if (error) throw serviceError(error, 'Failed to add behavior record')
  return data as StudentBehavior
}
