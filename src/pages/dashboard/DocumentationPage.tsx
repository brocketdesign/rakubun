import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  Globe,
  HelpCircle,
  Key,
  Lightbulb,
  Lock,
  Mail,

  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n';

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
};

export default function DocumentationPage() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const doc = t.documentation;
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openEndpoint, setOpenEndpoint] = useState<number | null>(null);

  return (
    <div className="max-w-[860px] mx-auto space-y-10 pb-12">
      {/* Back link + Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-rakubun-text-secondary hover:text-rakubun-accent transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {doc.backToDashboard}
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-rakubun-accent/10">
            <BookOpen className="w-6 h-6 text-rakubun-accent" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-rakubun-text">
            {doc.title}
          </h1>
        </div>
        <p className="text-rakubun-text-secondary">
          {doc.subtitle}
        </p>
      </div>

      {/* ============================================= */}
      {/* Section 1 – How to Connect Your WordPress Site */}
      {/* ============================================= */}
      <section className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Globe className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {doc.connectSection.title}
          </h2>
        </div>

        <p className="text-sm text-rakubun-text-secondary leading-relaxed">
          {doc.connectSection.intro}
        </p>

        {/* Requirements */}
        <div className="bg-rakubun-bg rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-rakubun-text flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {doc.connectSection.requirements.title}
          </h3>
          <ul className="space-y-2">
            {doc.connectSection.requirements.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-rakubun-text-secondary">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rakubun-accent shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Connection Steps */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-rakubun-text">
            {doc.connectSection.steps.title}
          </h3>
          <div className="space-y-4">
            {doc.connectSection.steps.items.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-rakubun-accent/10 text-rakubun-accent flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </div>
                  {i < doc.connectSection.steps.items.length - 1 && (
                    <div className="w-px flex-1 bg-rakubun-border mt-2" />
                  )}
                </div>
                <div className="pb-4">
                  <h4 className="text-sm font-semibold text-rakubun-text mb-1">
                    {step.title}
                  </h4>
                  <p className="text-sm text-rakubun-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================= */}
      {/* Section 2 – How to Get an Application Password */}
      {/* ============================================= */}
      <section className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Key className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {doc.appPasswordSection.title}
          </h2>
        </div>

        <p className="text-sm text-rakubun-text-secondary leading-relaxed">
          {doc.appPasswordSection.intro}
        </p>

        {/* What is an App Password? */}
        <div className="bg-rakubun-bg rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-rakubun-text flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-rakubun-accent" />
            {doc.appPasswordSection.whatIs.title}
          </h3>
          <p className="text-sm text-rakubun-text-secondary leading-relaxed">
            {doc.appPasswordSection.whatIs.description}
          </p>
        </div>

        {/* Step-by-step */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-rakubun-text">
            {doc.appPasswordSection.steps.title}
          </h3>
          <div className="space-y-4">
            {doc.appPasswordSection.steps.items.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </div>
                  {i < doc.appPasswordSection.steps.items.length - 1 && (
                    <div className="w-px flex-1 bg-rakubun-border mt-2" />
                  )}
                </div>
                <div className="pb-4">
                  <h4 className="text-sm font-semibold text-rakubun-text mb-1">
                    {step.title}
                  </h4>
                  <p className="text-sm text-rakubun-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            {doc.appPasswordSection.tips.title}
          </h3>
          <ul className="space-y-2">
            {doc.appPasswordSection.tips.items.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300/80">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================= */}
      {/* Section 3 – API Reference                     */}
      {/* ============================================= */}
      <section className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10">
            <Code2 className="w-5 h-5 text-indigo-500" />
          </div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {doc.apiSection.title}
          </h2>
        </div>

        <p className="text-sm text-rakubun-text-secondary leading-relaxed">
          {doc.apiSection.intro}
        </p>

        {/* Base URL */}
        <div className="bg-rakubun-bg rounded-xl p-4">
          <p className="text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider mb-1.5">
            {doc.apiSection.baseUrl}
          </p>
          <code className="text-sm font-mono text-rakubun-accent">
            https://api.rakubun.app/api/v1
          </code>
        </div>

        {/* Authentication */}
        <div className="bg-rakubun-bg rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-rakubun-text flex items-center gap-2">
            <Lock className="w-4 h-4 text-rakubun-text-secondary" />
            {doc.apiSection.authentication}
          </p>
          <p className="text-sm text-rakubun-text-secondary leading-relaxed">
            {doc.apiSection.authDescription}
          </p>
          <div className="bg-rakubun-surface rounded-lg p-3 border border-rakubun-border">
            <code className="text-xs font-mono text-rakubun-text-secondary">
              Authorization: Bearer YOUR_API_KEY
            </code>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-rakubun-text">
            {language === 'en' ? 'Endpoints' : 'エンドポイント'}
          </h3>
          <div className="divide-y divide-rakubun-border rounded-xl overflow-hidden border border-rakubun-border">
            {doc.apiSection.endpoints.map((endpoint, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-rakubun-bg/50 transition-colors"
                  onClick={() => setOpenEndpoint(openEndpoint === i ? null : i)}
                >
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                      methodColors[endpoint.method] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {endpoint.method}
                  </span>
                  <code className="text-sm font-mono text-rakubun-text-secondary">
                    {endpoint.path}
                  </code>
                  <span className="flex-1 text-sm font-medium text-rakubun-text text-right truncate ml-2">
                    {endpoint.title}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-rakubun-text-secondary shrink-0 transition-transform duration-200 ${
                      openEndpoint === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openEndpoint === i && (
                  <div className="px-5 pb-5 space-y-3">
                    <p className="text-sm text-rakubun-text-secondary leading-relaxed">
                      {endpoint.description}
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider mb-2">
                        {language === 'en' ? 'Response Example' : 'レスポンス例'}
                      </p>
                      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                        {endpoint.responseExample}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================= */}
      {/* Section 4 – Troubleshooting / FAQ             */}
      {/* ============================================= */}
      <section className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/10">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {doc.troubleshooting.title}
          </h2>
        </div>

        <div className="divide-y divide-rakubun-border rounded-xl overflow-hidden border border-rakubun-border">
          {doc.troubleshooting.items.map((item, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-rakubun-bg/50 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="text-sm font-medium text-rakubun-text">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-rakubun-text-secondary shrink-0 transition-transform duration-200 ${
                    openFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-rakubun-text-secondary leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================= */}
      {/* Section 5 – Need Help CTA                     */}
      {/* ============================================= */}
      <section className="bg-gradient-to-r from-rakubun-accent/5 to-blue-500/5 rounded-2xl border border-rakubun-accent/20 p-6 md:p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 rounded-2xl bg-rakubun-accent/10">
            <Mail className="w-6 h-6 text-rakubun-accent" />
          </div>
        </div>
        <h2 className="text-lg font-heading font-bold text-rakubun-text">
          {doc.needHelp.title}
        </h2>
        <p className="text-sm text-rakubun-text-secondary max-w-md mx-auto">
          {doc.needHelp.description}
        </p>
        <button className="btn-primary text-sm">
          {doc.needHelp.cta}
        </button>
      </section>
    </div>
  );
}
