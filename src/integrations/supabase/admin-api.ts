import { supabase } from "./client";

const FUNCTION_NAME = "admin-users";

interface AdminCallOptions {
  action: string;
  [key: string]: any;
}

/**
 * Calls the admin-users Edge Function with the current user's JWT.
 * The Edge Function validates that the caller is an admin before
 * performing any privileged operations using the service role key
 * (which never leaves the server).
 */
export async function callAdminFunction(options: AdminCallOptions) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke(FUNCTION_NAME, {
    body: options,
  });

  if (response.error) {
    // Try to extract message from the edge function response
    const msg = response.error.message || "Admin operation failed";
    throw new Error(msg);
  }

  return response.data;
}
