// Delete-account Edge Function.
//
// Apple guideline 5.1.1(v) requires in-app account deletion to REALLY
// delete the account — including the auth identity. The client can't
// remove its own auth.users row, so this function does it with the
// service-role key:
//   1. validates the caller's JWT,
//   2. removes their avatar from storage,
//   3. deletes the profile row (FK cascades take dependent rows),
//   4. deletes the auth user itself.
//
// Deploy once with:
//   supabase functions deploy delete-account
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically
// on hosted Supabase — no secrets to configure.)

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ ok: false, error: 'missing auth' }), { status: 401 });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid token' }), { status: 401 });
    }
    const uid = userData.user.id;

    // Best-effort storage cleanup; the account deletes regardless.
    try {
      await admin.storage.from('avatars').remove([`${uid}/avatar.jpg`]);
    } catch (_e) {
      // ignore
    }

    await admin.from('profiles').delete().eq('id', uid);

    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
