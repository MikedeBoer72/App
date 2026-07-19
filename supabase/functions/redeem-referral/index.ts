// Redeem a referral code (called once by a NEW user, from onboarding).
//
// Validates the caller's JWT, looks up the code's registry row, and
// inserts a redemption row {referrer, referred=caller, code}. RLS
// blocks the referred user from writing the referrer's rows, so this
// runs with the service role. The partial unique index
// referrals_referred_once_uniq guarantees one redemption per user.
//
// Deploy: supabase functions deploy redeem-referral

import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ ok: false, error: 'missing auth' }, 401);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? '').trim();
    if (!code) return json({ ok: false, error: 'missing code' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ ok: false, error: 'invalid token' }, 401);
    const uid = userData.user.id;

    // Registry row for this code (case-insensitive; no wildcards in
    // the pattern, so ilike is plain case-insensitive equality).
    const { data: registry } = await admin
      .from('referrals')
      .select('referrer_id, referral_code')
      .ilike('referral_code', code)
      .is('referred_id', null)
      .maybeSingle();
    if (!registry) return json({ ok: false, error: 'Code not found' }, 404);
    if (registry.referrer_id === uid) {
      return json({ ok: false, error: "You can't redeem your own code" }, 400);
    }

    const { error: insErr } = await admin.from('referrals').insert({
      referrer_id:   registry.referrer_id,
      referred_id:   uid,
      referral_code: registry.referral_code,
    });
    if (insErr) {
      const already = insErr.code === '23505';
      return json(
        { ok: false, error: already ? 'You already used a referral code' : insErr.message },
        already ? 409 : 500,
      );
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
