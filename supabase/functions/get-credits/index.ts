import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyClerkJWT } from '../_shared/clerk.ts'

Deno.serve(async (req) => {
  // This is required for browsers to allow the request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Securely verify the user's token from Clerk
    const { userId } = await verifyClerkJWT(req)
    if (!userId) {
      throw new Error('User not found in JWT.')
    }

    // Create a Supabase client with admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch the user's profile
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('credit_balance')
      .eq('id', userId)
      .single()

    if (error) throw error

    // Send the data back to the app
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})