import type { SupabaseClient } from '@supabase/supabase-js'

// Duplicate detection by phone number. Website visitors sometimes submit the
// consult form more than once; a new lead whose phone matches an existing lead
// is put in the "Check Duplicate" stage so staff can review/merge it.

// Reduce a phone number to its last 10 digits so "(212) 555-0147",
// "212.555.0147" and "+1 212 555 0147" all compare equal. Returns null when
// there aren't enough digits to be a real number.
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  return digits.length > 10 ? digits.slice(-10) : digits
}

export interface DuplicateMatch {
  id: string
  first_name: string
  last_name: string
  stage: string
  created_at: string
}

// Find existing leads with the same phone number (optionally excluding one
// lead, e.g. the lead being viewed). Formatting differences are ignored.
export async function findPhoneDuplicates(
  supabase: SupabaseClient,
  phone?: string | null,
  excludeId?: string
): Promise<DuplicateMatch[]> {
  const norm = normalizePhone(phone)
  if (!norm) return []

  // Narrow in the database by the last 4 digits (always contiguous in any
  // common format), then compare the normalized numbers exactly.
  let query = supabase
    .from('leads')
    .select('id, first_name, last_name, phone, stage, created_at')
    .ilike('phone', `%${norm.slice(-4)}%`)
    .order('created_at', { ascending: true })
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error('Duplicate check failed:', error)
    return []
  }

  return data
    .filter((l) => normalizePhone(l.phone) === norm)
    .map(({ id, first_name, last_name, stage, created_at }) => ({
      id,
      first_name,
      last_name,
      stage,
      created_at,
    }))
}

// Shared by the website intake and the manual "Add Lead" form: insert a lead,
// switching a would-be "New Lead" to "Check Duplicate" when the phone number
// already exists, and log which lead(s) it matches.
export async function insertLeadWithDuplicateCheck(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  select = '*'
) {
  const matches = await findPhoneDuplicates(supabase, row.phone as string | null)
  const flag = matches.length > 0 && (!row.stage || row.stage === 'new_lead')

  let result = await supabase
    .from('leads')
    .insert({ ...row, stage: flag ? 'check_duplicate' : row.stage || 'new_lead' })
    .select(select)
    .single()

  // Safety net: if the database hasn't been migrated to allow the
  // 'check_duplicate' stage yet, never lose the lead — save it as a New Lead.
  if (result.error && flag && /stage/i.test(result.error.message)) {
    console.error('check_duplicate stage rejected; saving as new_lead:', result.error)
    row = { ...row, stage: 'new_lead' }
    result = await supabase.from('leads').insert(row).select(select).single()
  }

  // Safety net: if the zip_code column hasn't been added yet, save the lead
  // without it rather than lose it (the ZIP is kept in the message instead).
  if (result.error && 'zip_code' in row && /zip_code/i.test(result.error.message)) {
    console.error('zip_code column missing; saving lead without it:', result.error)
    const { zip_code, ...rest } = row
    row = zip_code
      ? { ...rest, message: [`[ZIP: ${zip_code}]`, rest.message].filter(Boolean).join('\n\n') }
      : rest
    result = await supabase
      .from('leads')
      .insert({ ...row, stage: flag ? 'check_duplicate' : row.stage || 'new_lead' })
      .select(select)
      .single()
    if (result.error && flag && /stage/i.test(result.error.message)) {
      result = await supabase.from('leads').insert({ ...row, stage: 'new_lead' }).select(select).single()
    }
  }

  const inserted = result.data as unknown as { id?: string } | null
  if (!result.error && inserted?.id && matches.length > 0) {
    const list = matches
      .map((m) => `${m.first_name} ${m.last_name} (added ${m.created_at.slice(0, 10)})`)
      .join('; ')
    await supabase.from('lead_notes').insert({
      lead_id: inserted.id,
      author: 'System',
      type: 'system',
      note: `Possible duplicate — same phone number as: ${list}`,
    })
  }

  return result
}
