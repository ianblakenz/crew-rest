/*
 * This is your "Security Guard" (Cloudflare Function).
 * It will run on Cloudflare's servers, not on the user's phone.
 */

export async function onRequestPost({ request, env }) {
  try {
    // 1. Get the email and staff number from the login page
    const loginAttempt = await request.json();
    const userEmail = loginAttempt.email.toLowerCase();
    const userStaffNumber = loginAttempt.staffNumber;

    // --- Helper function to log analytics ---
    const logLoginAttempt = (status, successValue) => {
      // Check if the Analytics Engine binding exists
      if (env.LOGIN_ANALYTICS) {
        env.LOGIN_ANALYTICS.writeDataPoint({
          blobs: [
            userEmail,          // Log the email (blob 1)
            userStaffNumber,    // Log the staff number (blob 2)
            status,             // "success" or "failure" (blob 3)
            request.headers.get("cf-ipcountry") || "unknown", // User's country (blob 4)
            request.headers.get("User-Agent") || "unknown"    // User's device/browser (blob 5)
          ],
          doubles: [
            successValue        // 1.0 for success, 0.0 for failure (double 1)
          ]
        });
      }
    };
    // --- End of helper function ---


    // 2. Get the valid member list from your R2 bucket
    const memberObject = await env.MEMBER_LIST_BUCKET.get('members.json');
    if (memberObject === null) {
      return new Response(JSON.stringify({ success: false, error: 'Member list not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const memberList = await memberObject.json();

    // 3. Check if the user's details are in the list
    const isValidUser = memberList.some(
      (member) =>
        member.email.toLowerCase() === userEmail &&
        member.staffNumber === userStaffNumber
    );

    // 4. Send back the result AND log the attempt
    if (isValidUser) {
      logLoginAttempt("success", 1.0); // Log the successful login
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      logLoginAttempt("failure", 0.0); // Log the failed login
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    // Also log errors
    if (env.LOGIN_ANALYTICS) {
      env.LOGIN_ANALYTICS.writeDataPoint({
        blobs: ["error", err.message, request.headers.get("cf-ipcountry") || "unknown"],
        doubles: [0.0]
      });
    }
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}