// Mark the caller's referral as CONVERTED (they subscribed) and grant
// the referrer their free month.
//
// Called fire-and-forget by the app whenever the caller's Pro
// entitlement flips on (lib/revenuecat.ts). Idempotent: rows already
// converted are skipped.
//
// The free month is granted through RevenueCat's promotional
// entitlement API. Configure the secret once:
//   supabase secrets set REVENUECAT_SECRET_KEY=sk_...
// Without the secret, conversion is still recorded (free_month_given
// stays false) so the reward can be granted retroactively.
//
// Deploy: supabase functions deploy convert-referral

import { createClient } from 'npm:@supabase/supabase-js@2';

const PRO_ENTITLEMENT = 'pro';

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ ok: false, error: 'invalid token' }, 401);
    const uid = userData.user.id;

    // Unconverted redemption rows where the caller is the referred user
    // (there is at most one, thanks to referrals_referred_once_uniq).
    const { data: rows } = await admin
      .from('referrals')
      .select('id, referrer_id, free_month_given')
      .eq('referred_id', uid)
      .eq('is_converted', false);
    if (!rows || rows.length === 0) return json({ ok: true, converted: 0 });

    const rcSecret = Deno.env.get('REVENUECAT_SECRET_KEY');
    let granted = 0;

    for (const row of rows) {
      await admin
        .from('referrals')
        .update({ is_converted: true, converted_at: new Date().toISOString() })
        .eq('id', row.id);

      if (rcSecret && !row.free_month_given) {
        // Grant the referrer 1 month of the pro entitlement.
        const res = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(row.referrer_id)}/entitlements/${PRO_ENTITLEMENT}/promotional`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${rcSecret}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ duration: 'monthly' }),
          },
        );
        if (res.ok) {
          granted++;
          await admin.from('referrals').update({ free_month_given: true }).eq('id', row.id);
        } else {
          console.error('revenuecat grant failed', res.status, await res.text());
        }
      }
    }

    return json({ ok: true, converted: rows.length, granted });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
