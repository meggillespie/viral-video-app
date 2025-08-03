// supabase/functions/get-credits/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyClerkJWT } from '../_shared/clerk.ts'

console.log("get-credits function booting up.");

Deno.serve(async (req) => {
  // Handle CORS preflight requests. This must be handled before any other logic.
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders, status: 200 }); // Explicitly return 200 OK
  }

  try {
    console.log("Verifying user token...");
    const { userId } = await verifyClerkJWT(req);
    console.log(`Token verified for user: ${userId}`);

    // Create a Supabase client with the service_role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    console.log("Supabase admin client created.");

    // Fetch the user's profile from the 'profiles' table
    console.log(`Fetching profile for user ID: ${userId}`);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Supabase query error:", error.message);
      throw error;
    }
    
    if (!data) {
        throw new Error(`No profile found for user ID: ${userId}`);
    }

    console.log("Successfully fetched data:", data);

    // Return the user's credit balance
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Caught error in main handler:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401, // Use 401 for auth-related errors
    });
  }
});
