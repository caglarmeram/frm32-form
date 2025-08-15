// netlify/functions/validate-invite.js
const { createClient } = require('@supabase/supabase-js')

const CORS = {
  'Access-Control-Allow-Origin': 'https://snsd-evrengpt.netlify.app', // kendi domainin
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  try {
    const token =
      (event.queryStringParameters && (event.queryStringParameters.token || event.queryStringParameters.invite)) || ''

    if (!token) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'missing_token' }) }
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE // service role key (UI'da Env Var olarak ekle)
    )

    const { data, error } = await supabase
      .from('frm35_invites')
      .select('id, parent_form32_id, contractor_name, status, invite_expires_at, used_at')
      .eq('invite_token', token)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'invalid_token' }) }
    }

    const now = new Date()
    const exp = new Date(data.invite_expires_at)
    const expired = isNaN(exp.getTime()) ? true : exp < now
    const used = !!data.used_at
    const blocked = data.status && data.status !== 'pending'

    if (expired)  return { statusCode: 410, headers: CORS, body: JSON.stringify({ ok: false, error: 'expired' }) }
    if (used)     return { statusCode: 409, headers: CORS, body: JSON.stringify({ ok: false, error: 'already_used' }) }
    if (blocked)  return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'blocked' }) }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        invite: {
          token,
          parent_form32_id: data.parent_form32_id,
          contractor_name: data.contractor_name,
          invite_expires_at: data.invite_expires_at,
        },
      }),
    }
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: 'server_error', detail: String(e) }) }
  }
}
