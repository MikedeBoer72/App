-- 009: referral redemption model.
--
-- The original schema had UNIQUE(referral_code), which only allows the
-- single "code registry" row per referrer (referred_id null). Real
-- redemptions insert ONE ROW PER REFERRED FRIEND carrying the same
-- code, so uniqueness moves to two partial indexes:
--   * one registry row per code            (rows with referred_id null)
--   * each user can be referred only once  (rows with referred_id set)
--
-- Redemption + conversion writes happen in the redeem-referral /
-- convert-referral Edge Functions with the service role, because RLS
-- (correctly) only lets the referrer write their own rows.

alter table referrals drop constraint if exists referrals_referral_code_key;

create unique index if not exists referrals_code_registry_uniq
  on referrals (referral_code)
  where referred_id is null;

create unique index if not exists referrals_referred_once_uniq
  on referrals (referred_id)
  where referred_id is not null;
