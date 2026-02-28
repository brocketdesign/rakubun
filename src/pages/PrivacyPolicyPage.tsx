import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-rakubun-bg text-rakubun-text">
      {/* Header */}
      <header className="border-b border-rakubun-border bg-rakubun-surface/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-rakubun-muted hover:text-rakubun-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-heading font-bold text-lg text-rakubun-text">RakuBun</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {language === 'ja' ? <PrivacyPolicyJA /> : <PrivacyPolicyEN />}
      </main>

      {/* Footer */}
      <footer className="border-t border-rakubun-border py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-rakubun-muted">
            © {new Date().getFullYear()} RakuBun. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-sm text-rakubun-muted hover:text-rakubun-text transition-colors">
              {language === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}
            </Link>
            <Link to="/user-policy" className="text-sm text-rakubun-muted hover:text-rakubun-text transition-colors">
              {language === 'ja' ? '利用規約' : 'User Policy'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PrivacyPolicyEN() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-rakubun-muted">Last updated: February 28, 2026</p>

      <p>
        RakuBun ("we", "our", or "us") operates the website <strong>rakubun.com</strong> and related services.
        This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
        Service.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Account Information</h3>
      <p>
        When you sign up we collect information provided by your authentication provider (via Clerk), including your
        name, email address, and profile picture.
      </p>

      <h3>1.2 WordPress Connection Data</h3>
      <p>
        To provide our core service, we store your WordPress site URL and an Application Password. The Application
        Password is encrypted at rest and is used solely to interact with your WordPress REST API on your behalf.
      </p>

      <h3>1.3 Usage &amp; Analytics Data</h3>
      <p>
        We may collect analytics data about how you use the Service, including pages viewed, features used, and
        interaction patterns. We may use third-party analytics tools such as Google Analytics.
      </p>

      <h3>1.4 Content Data</h3>
      <p>
        Articles, research results, analysis reports, and scheduling data you create through the Service are stored
        in our databases to provide and improve the Service.
      </p>

      <h3>1.5 Payment Information</h3>
      <p>
        Payment processing is handled by Stripe. We do not directly store your credit card details. Please refer to{' '}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
          Stripe's Privacy Policy
        </a>{' '}
        for details on how they handle payment data.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide, maintain, and improve the Service</li>
        <li>Publish articles to your WordPress site on your behalf</li>
        <li>Analyze your site content to generate recommendations</li>
        <li>Process transactions and manage subscriptions</li>
        <li>Send service-related communications and notifications</li>
        <li>Detect and prevent fraud or abuse</li>
      </ul>

      <h2>3. Data Sharing &amp; Third Parties</h2>
      <p>We do not sell your personal data. We may share information with:</p>
      <ul>
        <li><strong>Clerk</strong> — authentication services</li>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>OpenAI / AI Providers</strong> — to generate content and analysis (no personal data is sent; only site content data needed for generation)</li>
        <li><strong>MongoDB Atlas</strong> — database hosting</li>
        <li><strong>Vercel</strong> — application hosting</li>
        <li><strong>Google Analytics</strong> — usage analytics (if enabled)</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active or as needed to provide the Service. When you
        delete your account, we will delete or anonymize your data within 30 days, except where retention is required
        by law.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We use industry-standard security measures to protect your data, including encryption in transit (TLS) and at
        rest. WordPress Application Passwords are encrypted before storage. However, no method of transmission or
        storage is 100% secure.
      </p>

      <h2>6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Export your data in a portable format</li>
        <li>Withdraw consent for data processing</li>
      </ul>
      <p>
        To exercise any of these rights, please contact us at{' '}
        <a href="mailto:support@rakubun.com">support@rakubun.com</a>.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use essential cookies for authentication and session management. Third-party analytics services may use
        additional cookies. You can control cookie preferences through your browser settings.
      </p>

      <h2>8. International Data Transfers</h2>
      <p>
        Your data may be processed in countries other than your own. We ensure appropriate safeguards are in place
        for any international data transfers in accordance with applicable data protection laws.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        The Service is not directed to children under 16. We do not knowingly collect personal data from children
        under 16. If you believe we have collected such data, please contact us immediately.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by posting the
        updated policy on this page and updating the "Last updated" date.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us at{' '}
        <a href="mailto:support@rakubun.com">support@rakubun.com</a>.
      </p>
    </article>
  );
}

function PrivacyPolicyJA() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>プライバシーポリシー</h1>
      <p className="text-rakubun-muted">最終更新日：2026年2月28日</p>

      <p>
        RakuBun（以下「当社」）は、ウェブサイト <strong>rakubun.com</strong> および関連サービス（以下「本サービス」）を運営しています。
        本プライバシーポリシーは、本サービスをご利用いただく際の情報の収集、使用、開示、保護について説明します。
      </p>

      <h2>1. 収集する情報</h2>

      <h3>1.1 アカウント情報</h3>
      <p>
        ご登録時に、認証プロバイダー（Clerk経由）から提供される氏名、メールアドレス、プロフィール画像などの情報を収集します。
      </p>

      <h3>1.2 WordPress接続データ</h3>
      <p>
        コアサービスを提供するために、WordPressサイトのURLとアプリケーションパスワードを保存します。
        アプリケーションパスワードは暗号化して保存され、お客様に代わってWordPress REST APIと通信するためにのみ使用されます。
      </p>

      <h3>1.3 利用状況・アナリティクスデータ</h3>
      <p>
        閲覧ページ、使用機能、操作パターンなど、サービスの利用状況に関するデータを収集する場合があります。
        Google Analyticsなどのサードパーティ分析ツールを使用する場合があります。
      </p>

      <h3>1.4 コンテンツデータ</h3>
      <p>
        本サービスを通じて作成された記事、調査結果、分析レポート、スケジュールデータは、
        サービスの提供および改善のためにデータベースに保存されます。
      </p>

      <h3>1.5 決済情報</h3>
      <p>
        決済処理はStripeが行います。クレジットカード情報を直接保存することはありません。
        決済データの取り扱いについては、
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
          Stripeのプライバシーポリシー
        </a>
        をご参照ください。
      </p>

      <h2>2. 情報の使用目的</h2>
      <ul>
        <li>本サービスの提供、維持、改善</li>
        <li>お客様に代わってWordPressサイトへの記事公開</li>
        <li>サイトコンテンツの分析と提案の生成</li>
        <li>取引の処理とサブスクリプションの管理</li>
        <li>サービスに関する連絡・通知の送信</li>
        <li>不正行為の検出と防止</li>
      </ul>

      <h2>3. データの共有と第三者</h2>
      <p>お客様の個人データを販売することはありません。以下のサービスと情報を共有する場合があります：</p>
      <ul>
        <li><strong>Clerk</strong> — 認証サービス</li>
        <li><strong>Stripe</strong> — 決済処理</li>
        <li><strong>OpenAI / AIプロバイダー</strong> — コンテンツおよび分析の生成（個人データは送信されず、生成に必要なサイトコンテンツデータのみ）</li>
        <li><strong>MongoDB Atlas</strong> — データベースホスティング</li>
        <li><strong>Vercel</strong> — アプリケーションホスティング</li>
        <li><strong>Google Analytics</strong> — 利用状況分析（有効な場合）</li>
      </ul>

      <h2>4. データの保持</h2>
      <p>
        アカウントが有効な間、またはサービス提供に必要な期間、データを保持します。
        アカウントを削除された場合、法律で保持が義務付けられている場合を除き、30日以内にデータを削除または匿名化します。
      </p>

      <h2>5. データのセキュリティ</h2>
      <p>
        データの保護のために、転送中（TLS）および保存時の暗号化を含む業界標準のセキュリティ対策を使用しています。
        WordPressアプリケーションパスワードは保存前に暗号化されます。
        ただし、100%安全な転送・保存方法は存在しません。
      </p>

      <h2>6. お客様の権利</h2>
      <p>お住まいの地域により、以下の権利を有する場合があります：</p>
      <ul>
        <li>当社が保持するお客様の個人データへのアクセス</li>
        <li>不正確なデータの修正の要求</li>
        <li>データの削除の要求</li>
        <li>ポータブル形式でのデータのエクスポート</li>
        <li>データ処理への同意の撤回</li>
      </ul>
      <p>
        これらの権利を行使するには、
        <a href="mailto:support@rakubun.com">support@rakubun.com</a> までご連絡ください。
      </p>

      <h2>7. Cookie</h2>
      <p>
        認証およびセッション管理のために必須Cookieを使用しています。
        サードパーティの分析サービスが追加のCookieを使用する場合があります。
        ブラウザの設定でCookieの設定を制御できます。
      </p>

      <h2>8. 国際データ転送</h2>
      <p>
        お客様のデータは、お住まいの国以外で処理される場合があります。
        適用されるデータ保護法に従い、国際データ転送に対して適切な保護措置を講じています。
      </p>

      <h2>9. お子様のプライバシー</h2>
      <p>
        本サービスは16歳未満のお子様を対象としていません。
        16歳未満のお子様から意図的に個人データを収集することはありません。
        そのようなデータが収集されたと思われる場合は、直ちにご連絡ください。
      </p>

      <h2>10. ポリシーの変更</h2>
      <p>
        本プライバシーポリシーは随時更新される場合があります。
        重要な変更については、このページに更新版を掲載し、「最終更新日」を更新してお知らせします。
      </p>

      <h2>11. お問い合わせ</h2>
      <p>
        本プライバシーポリシーに関するご質問は、
        <a href="mailto:support@rakubun.com">support@rakubun.com</a> までお問い合わせください。
      </p>
    </article>
  );
}
