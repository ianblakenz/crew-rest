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

    // 2. Get the valid member list from your R2 bucket
    //    'MEMBER_LIST_BUCKET' is the name of your R2 binding
    const memberObject = await env.MEMBER_LIST_BUCKET.get('members.json');
    if (memberObject === null) {
      return new Response(JSON.stringify({ success: false, error: 'Member list not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const memberList = await memberObject.json();

    // 3. Check if the user's details are in the list
    //    We assume your JSON is an array of objects: [{ "email": "...", "staffNumber": "..." }]
    const isValidUser = memberList.some(
      (member) =>
        member.email.toLowerCase() === userEmail &&
        member.staffNumber === userStaffNumber
    );

    // 4. Send back the result
    if (isValidUser) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}