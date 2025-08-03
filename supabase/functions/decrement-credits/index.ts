// File: supabase/functions/decrement-credits/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyClerkJWT } from '../_shared/clerk.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the user's JWT
    const { userId } = await verifyClerkJWT(req)

    // Create a Supabase admin client to call the database function
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Call the 'decrement_user_credit' database function
    const { error } = await supabaseAdmin.rpc('decrement_user_credit', {
      user_id_to_update: userId
    })

    if (error) throw error

    // Return a success response
    return new Response(JSON.stringify({ message: 'Credit decremented successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }
})
