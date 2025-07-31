// This single, robust useEffect handles authentication and data fetching
  useEffect(() => {
    const loadUserData = async () => {
      // **CRUCIAL FIX**: Wait until we have a user and a user.id before doing anything
      if (user && user.id) { 
        setIsFetchingCredits(true);
        try {
          const supabaseToken = await getToken({ template: 'supabase' });
          if (!supabaseToken) throw new Error("Clerk token not found.");
          
          await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });

          // THE FIX IS HERE: We have removed .single() to make the query less strict
          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id); // <--- No .single()

          if (error) throw error;
          
          // Now, data will be an array. It might be empty [] or have one item.
          if (data && data.length > 0) {
            setCreditBalance(data[0].credit_balance);
          } else {
            // If the array is empty, no profile was found.
            console.warn("Profile not found for user, defaulting to 0 credits for now.");
            setCreditBalance(0);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setCreditBalance(0);
        } finally {
          setIsFetchingCredits(false);
        }
      }
    };

    loadUserData();
  }, [user, getToken]);