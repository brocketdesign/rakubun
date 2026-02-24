import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import {
  Crown, Zap, Check, ArrowRight, CreditCard, Settings,
  Loader2, AlertCircle, Globe, FileText, Calendar, Brain,
  Search, Timer, Shield,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import {
  useSubscription, useSubscriptionLoading, subscriptionActions,
  useCurrentPlan, PLAN_DISPLAY, STRIPE_PRICES,
  type PlanId,
} from '../../stores/subscriptionStore';
import { UsageMeter } from '../../components/UpgradePrompt';

// ─── Plan definitions for the billing page ──────────────────────────────────

interface PlanDef {
  id: PlanId;
  priceMonthly: string;
  priceYearly: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  highlighted: boolean;
  icon: typeof Crown;
  features: { en: string; ja: string }[];
}

const plans: PlanDef[] = [
  {
    id: 'free',
    priceMonthly: '$0',
    priceYearly: '$0',
    monthlyPriceId: '',
    yearlyPriceId: '',
    highlighted: false,
    icon: Shield,
    features: [
      { en: '1 site', ja: '1サイト' },
      { en: '3 articles/month', ja: '月3記事' },
      { en: '3 schedules', ja: '3スケジュール' },
      { en: 'Basic support', ja: '基本サポート' },
    ],
  },
  {
    id: 'basic',
    priceMonthly: '$9',
    priceYearly: '$90',
    monthlyPriceId: STRIPE_PRICES.basic_monthly,
    yearlyPriceId: STRIPE_PRICES.basic_yearly,
    highlighted: false,
    icon: Zap,
    features: [
      { en: '3 sites', ja: '3サイト' },
      { en: '30 articles/month', ja: '月30記事' },
      { en: '10 schedules', ja: '10スケジュール' },
      { en: 'Cron jobs', ja: 'Cronジョブ' },
      { en: 'Image generation', ja: '画像生成' },
      { en: 'Priority support', ja: '優先サポート' },
    ],
  },
  {
    id: 'premium',
    priceMonthly: '$29',
    priceYearly: '$290',
    monthlyPriceId: STRIPE_PRICES.premium_monthly,
    yearlyPriceId: STRIPE_PRICES.premium_yearly,
    highlighted: true,
    icon: Crown,
    features: [
      { en: 'Unlimited sites', ja: '無制限サイト' },
      { en: 'Unlimited articles', ja: '無制限記事' },
      { en: 'Unlimited schedules', ja: '無制限スケジュール' },
      { en: 'AI Analysis', ja: 'AI分析' },
      { en: 'Research', ja: 'リサーチ' },
      { en: 'Cron jobs', ja: 'Cronジョブ' },
      { en: 'API access', ja: 'APIアクセス' },
      { en: 'Dedicated support', ja: '専任サポート' },
    ],
  },
];

export default function BillingPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const sub = useSubscription();
  const subLoading = useSubscriptionLoading();
  const currentPlan = useCurrentPlan();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const billingStatus = searchParams.get('billing');

  useEffect(() => {
    if (!subscriptionActions.isLoaded() && !subscriptionActions.isLoading()) {
      subscriptionActions.loadSubscription(getToken);
    }
  }, [getToken]);

  // Refresh after successful checkout
  useEffect(() => {
    if (billingStatus === 'success') {
      subscriptionActions.refresh(getToken);
    }
  }, [billingStatus, getToken]);

  const handleUpgrade = async (priceId: string) => {
    if (!priceId) return;
    setCheckoutLoading(priceId);
    try {
      const url = await subscriptionActions.createCheckout(getToken, priceId);
      if (url) {
        window.location.href = url;
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const url = await subscriptionActions.openPortal(getToken);
      if (url) {
        window.location.href = url;
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const planDisplay = PLAN_DISPLAY[currentPlan];

  return (
    <div className="space-y-6 max-w-[1000px]">
      {/* Success/Cancel banners */}
      {billingStatus === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <Check className="w-5 h-5 text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {language === 'en' ? 'Your subscription has been activated! Welcome aboard.' : 'サブスクリプションが有効になりました！'}
          </p>
        </div>
      )}
      {billingStatus === 'canceled' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {language === 'en' ? 'Checkout was canceled. You can try again anytime.' : 'チェックアウトがキャンセルされました。いつでもお試しください。'}
          </p>
        </div>
      )}

      {/* Current Plan & Usage */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${planDisplay.badge}`}>
              {planDisplay.name[language]}
            </div>
            {sub.subscription?.cancelAtPeriodEnd && (
              <span className="text-xs text-amber-500 font-medium">
                {language === 'en' ? 'Cancels at period end' : '期間終了時にキャンセル'}
              </span>
            )}
          </div>
          {sub.subscription && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rakubun-border text-sm font-medium text-rakubun-text hover:bg-rakubun-bg transition-colors disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              {language === 'en' ? 'Manage Billing' : '請求管理'}
            </button>
          )}
        </div>

        {subLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-rakubun-text-secondary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-rakubun-bg rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-rakubun-text">
                  {language === 'en' ? 'Sites' : 'サイト'}
                </span>
              </div>
              <UsageMeter
                label=""
                used={sub.usage.sitesCount}
                limit={sub.limits.maxSites}
              />
            </div>
            <div className="bg-rakubun-bg rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-rakubun-text">
                  {language === 'en' ? 'Articles this month' : '今月の記事'}
                </span>
              </div>
              <UsageMeter
                label=""
                used={sub.usage.articlesThisPeriod}
                limit={sub.limits.maxArticlesPerMonth}
              />
            </div>
            <div className="bg-rakubun-bg rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-rakubun-text">
                  {language === 'en' ? 'Schedules' : 'スケジュール'}
                </span>
              </div>
              <UsageMeter
                label=""
                used={sub.usage.schedulesCount}
                limit={sub.limits.maxSchedules}
              />
            </div>
          </div>
        )}

        {/* Feature access */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'analysisEnabled', label: { en: 'AI Analysis', ja: 'AI分析' }, icon: Brain },
            { key: 'researchEnabled', label: { en: 'Research', ja: 'リサーチ' }, icon: Search },
            { key: 'cronJobsEnabled', label: { en: 'Cron Jobs', ja: 'Cronジョブ' }, icon: Timer },
            { key: 'apiAccessEnabled', label: { en: 'API Access', ja: 'APIアクセス' }, icon: Settings },
          ].map(({ key, label, icon: Icon }) => {
            const enabled = sub.limits[key as keyof typeof sub.limits] as boolean;
            return (
              <div
                key={key}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label[language]}
                {enabled ? <Check className="w-3 h-3" /> : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-rakubun-text' : 'text-rakubun-text-secondary'}`}>
          {language === 'en' ? 'Monthly' : '月額'}
        </span>
        <button
          onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            billingCycle === 'yearly' ? 'bg-rakubun-accent' : 'bg-rakubun-border'
          }`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
        <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-rakubun-text' : 'text-rakubun-text-secondary'}`}>
          {language === 'en' ? 'Yearly' : '年額'}
          <span className="ml-1 text-xs text-emerald-500 font-semibold">
            {language === 'en' ? '(Save 17%)' : '(17%お得)'}
          </span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
          const period = billingCycle === 'monthly'
            ? (language === 'en' ? '/mo' : '/月')
            : (language === 'en' ? '/yr' : '/年');
          const priceId = billingCycle === 'monthly' ? plan.monthlyPriceId : plan.yearlyPriceId;
          const isUpgrade = !isCurrent && plan.id !== 'free';
          const PlanIcon = plan.icon;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 transition-all duration-300 ${
                plan.highlighted
                  ? 'border-amber-300 dark:border-amber-500/40 bg-gradient-to-b from-amber-50/50 to-rakubun-surface dark:from-amber-500/5 dark:to-rakubun-surface shadow-lg'
                  : 'border-rakubun-border bg-rakubun-surface hover:shadow-md'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium rounded-full">
                    <Crown className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Most Popular' : '一番人気'}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <PlanIcon className={`w-5 h-5 ${plan.highlighted ? 'text-amber-500' : 'text-rakubun-text-secondary'}`} />
                  <h3 className="text-lg font-heading font-semibold text-rakubun-text">
                    {PLAN_DISPLAY[plan.id].name[language]}
                  </h3>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rakubun-accent/10 text-rakubun-accent">
                      {language === 'en' ? 'Current' : '現在'}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-heading font-bold text-rakubun-text">{price}</span>
                  <span className="text-sm text-rakubun-text-secondary">{period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f.en} className="flex items-center gap-2 text-sm text-rakubun-text">
                    <Check className="w-4 h-4 text-rakubun-accent shrink-0" />
                    {f[language]}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl border border-rakubun-border text-sm font-medium text-rakubun-text-secondary cursor-default"
                >
                  {language === 'en' ? 'Current Plan' : '現在のプラン'}
                </button>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(priceId)}
                  disabled={!!checkoutLoading || !priceId}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 shadow-sm'
                      : 'bg-rakubun-accent text-white hover:bg-rakubun-accent/90'
                  } disabled:opacity-50`}
                >
                  {checkoutLoading === priceId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {language === 'en' ? 'Upgrade' : 'アップグレード'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl border border-rakubun-border text-sm font-medium text-rakubun-text-secondary cursor-default"
                >
                  {language === 'en' ? 'Free Plan' : 'フリープラン'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6">
        <h3 className="text-lg font-heading font-semibold text-rakubun-text mb-4">
          {language === 'en' ? 'Frequently Asked Questions' : 'よくある質問'}
        </h3>
        <div className="space-y-4">
          {[
            {
              q: { en: 'Can I change plans anytime?', ja: 'いつでもプランを変更できますか？' },
              a: { en: 'Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and we\'ll prorate your bill.', ja: 'はい！いつでもアップグレードまたはダウングレードできます。変更は即座に反映され、日割り計算されます。' },
            },
            {
              q: { en: 'What happens when I hit my article limit?', ja: '記事の上限に達するとどうなりますか？' },
              a: { en: 'You\'ll be prompted to upgrade. Your existing articles remain intact. The limit resets each billing period.', ja: 'アップグレードが案内されます。既存の記事はそのまま残ります。上限は各請求期間にリセットされます。' },
            },
            {
              q: { en: 'Is there a free trial?', ja: '無料トライアルはありますか？' },
              a: { en: 'The Free plan is always available. For paid plans, you can cancel within the first 7 days for a full refund.', ja: 'フリープランは常にご利用いただけます。有料プランは最初の7日以内にキャンセルすれば全額返金されます。' },
            },
          ].map((faq, i) => (
            <details key={i} className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-rakubun-text py-2 hover:text-rakubun-accent transition-colors">
                {faq.q[language]}
                <ArrowRight className="w-4 h-4 text-rakubun-text-secondary group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-sm text-rakubun-text-secondary pb-2 pl-0">{faq.a[language]}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Payment Security */}
      <div className="flex items-center justify-center gap-2 text-xs text-rakubun-text-secondary">
        <CreditCard className="w-4 h-4" />
        {language === 'en'
          ? 'Payments secured by Stripe. We never see your card details.'
          : 'Stripeによる安全な決済。カード情報は当社に保存されません。'}
      </div>
    </div>
  );
}
