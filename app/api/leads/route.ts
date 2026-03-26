import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)

  const stage = searchParams.get('stage')
  const priority = searchParams.get('priority')
  const assignedTo = searchParams.get('assigned_to')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (priority) query = query.eq('priority', priority)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()

  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('leads')
      .insert({
        ...body,
        stage: body.stage || 'new_lead',
        priority: body.priority || 'medium',
        eligibility_status: body.eligibility_status || 'pending',
        contact_attempts: body.contact_attempts || 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating lead:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
