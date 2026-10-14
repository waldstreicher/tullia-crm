import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCorsHeaders, corsPreflight } from '@/lib/cors'
import { signBookingToken } from '@/lib/booking-token'

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    const body = await request.json()
    const { first_name, last_name, email, phone, preferred_contact, areas_of_interest, message, primary_goal } = body

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { error: 'first_name, last_name, and email are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Auto-prioritize consult requests for FAT REDUCTION ONLY as High.
    // The primary goal arrives either as a dedicated `primary_goal` field or is
    // embedded in the message as "[Primary goal: X]" (fat reduction / skin
    // tightening / both). "Both" and tightening-only stay at the default.
    const rawGoal =
      typeof primary_goal === 'string' && primary_goal.trim()
        ? primary_goal
        : typeof message === 'string'
          ? message.match(/\[\s*primary goal\s*:\s*([^\]]+)\]/i)?.[1] ?? ''
          : ''
    const fatReductionOnly = /fat/i.test(rawGoal) && !/(both|tighten)/i.test(rawGoal)
    const priority = fatReductionOnly ? 'high' : 'medium'

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('leads')
      .insert({
        first_name,
        last_name,
        email,
        phone: phone || null,
        preferred_contact: preferred_contact || null,
        areas_of_interest: areas_of_interest || [],
        message: message || null,
        source: 'website',
        stage: 'new_lead',
        priority,
        eligibility_status: 'pending',
        contact_attempts: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Intake error:', error)
      return NextResponse.json(
        { error: 'Failed to save lead' },
        { status: 500, headers: corsHeaders }
      )
    }

    // booking_token lets the website send the prospect straight to the
    // /schedule page to pick a follow-up call slot for this lead.
    return NextResponse.json(
      { success: true, id: data.id, booking_token: signBookingToken(data.id) },
      { status: 201, headers: corsHeaders }
    )
  } catch (err) {
    console.error('Intake parse error:', err)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: corsHeaders }
    )
  }
}
