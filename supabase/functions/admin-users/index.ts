import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a client with the user's JWT to verify their role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the user is admin by querying profiles
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Now use the service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case "create-user": {
        const { email, password, full_name, role, phone, tenant_id } = body;

        if (!email || !password || !full_name || !role) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate role
        const validRoles = ["admin", "manager", "operator", "viewer", "tenant"];
        if (!validRoles.includes(role)) {
          return new Response(JSON.stringify({ error: "Invalid role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create auth user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name,
            role,
            tenant_id: tenant_id || null,
            must_change_password: true,
          },
        });

        if (authError) throw authError;

        // Wait for trigger and update profile
        if (authData.user) {
          const profileBase: Record<string, any> = {
            full_name,
            phone: phone || null,
            role,
          };

          let retries = 5;
          let profileUpdateError: any = null;
          while (retries > 0) {
            const { error } = await adminClient
              .from("profiles")
              .update(profileBase)
              .eq("user_id", authData.user.id);
            profileUpdateError = error;
            if (!error) break;
            retries--;
            if (retries > 0) await new Promise((r) => setTimeout(r, 500));
          }

          if (profileUpdateError) {
            await adminClient.auth.admin.deleteUser(authData.user.id).catch(() => {});
            throw profileUpdateError;
          }

          // Set tenant_id if applicable
          if (tenant_id) {
            await adminClient
              .from("profiles")
              .update({ tenant_id } as any)
              .eq("user_id", authData.user.id)
              .then(({ error }) => {
                if (error) console.warn("tenant_id column not available:", error.message);
              });
          }
        }

        result = { user: authData.user };
        break;
      }

      case "update-user": {
        const { user_id, profile_id, email, full_name, role, phone, tenant_id, email_changed } = body;

        if (!user_id || !profile_id) {
          return new Response(JSON.stringify({ error: "Missing user_id or profile_id" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update email in auth if changed
        if (email_changed && email) {
          const { error: authError } = await adminClient.auth.admin.updateUserById(
            user_id,
            { email, email_confirm: true }
          );
          if (authError) throw authError;
        }

        // Update user_metadata
        await adminClient.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name, role, tenant_id: tenant_id || null },
        }).catch(() => {});

        // Update profile
        const profileUpdate: Record<string, any> = {
          full_name,
          phone: phone || null,
          role,
        };
        if (email_changed && email) {
          profileUpdate.email = email;
        }

        const { error } = await adminClient
          .from("profiles")
          .update(profileUpdate)
          .eq("id", profile_id);
        if (error) throw error;

        // Set tenant_id
        if (tenant_id) {
          await adminClient
            .from("profiles")
            .update({ tenant_id } as any)
            .eq("id", profile_id)
            .then(({ error }) => {
              if (error) console.warn("tenant_id column not available:", error.message);
            });
        }

        result = { success: true };
        break;
      }

      case "toggle-active": {
        const { profile_id, is_active } = body;
        if (!profile_id) {
          return new Response(JSON.stringify({ error: "Missing profile_id" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("profiles")
          .update({ is_active })
          .eq("id", profile_id);
        if (error) throw error;

        result = { success: true };
        break;
      }

      case "reset-password": {
        const { user_id, new_password } = body;
        if (!user_id || !new_password) {
          return new Response(JSON.stringify({ error: "Missing user_id or new_password" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (error) throw error;

        result = { success: true };
        break;
      }

      case "delete-user": {
        const { user_id } = body;
        if (!user_id) {
          return new Response(JSON.stringify({ error: "Missing user_id" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Prevent self-deletion
        if (user_id === user.id) {
          return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient.auth.admin.deleteUser(user_id);
        if (error) throw error;

        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Admin function error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
