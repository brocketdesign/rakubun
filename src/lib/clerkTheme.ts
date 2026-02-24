/**
 * Clerk appearance configuration that matches the RakuBun design theme.
 * Uses CSS custom properties so it automatically adapts to light/dark mode.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: 'hsl(220, 100%, 59%)',
    colorTextOnPrimaryBackground: 'hsl(0, 0%, 100%)',
    colorBackground: 'hsl(var(--rakubun-surface))',
    colorText: 'hsl(var(--rakubun-text))',
    colorTextSecondary: 'hsl(var(--rakubun-text-secondary))',
    colorInputBackground: 'hsl(var(--rakubun-bg))',
    colorInputText: 'hsl(var(--rakubun-text))',
    colorNeutral: 'hsl(var(--rakubun-text))',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyButtons: 'Inter, system-ui, sans-serif',
    borderRadius: '0.625rem',
    fontSize: '0.875rem',
    spacingUnit: '1rem',
  },
  elements: {
    // Root card
    rootBox: 'w-full',
    cardBox: 'shadow-card rounded-2xl border border-[hsl(var(--rakubun-border))]',
    card: 'bg-[hsl(var(--rakubun-surface))]',

    // Header
    headerTitle: 'font-heading text-[hsl(var(--rakubun-text))] font-semibold tracking-tight',
    headerSubtitle: 'text-[hsl(var(--rakubun-text-secondary))]',

    // Form fields
    formFieldLabel: 'text-[hsl(var(--rakubun-text))] font-medium',
    formFieldInput:
      'bg-[hsl(var(--rakubun-bg))] border-[hsl(var(--rakubun-border))] text-[hsl(var(--rakubun-text))] rounded-lg focus:ring-2 focus:ring-[hsl(220,100%,59%)] focus:border-[hsl(220,100%,59%)] transition-colors',
    formFieldInputShowPasswordButton: 'text-[hsl(var(--rakubun-text-secondary))]',

    // Primary button
    formButtonPrimary:
      'bg-[hsl(220,100%,59%)] hover:bg-[hsl(220,100%,52%)] text-white font-semibold rounded-lg shadow-sm transition-all duration-200',

    // Social / OAuth buttons
    socialButtonsBlockButton:
      'border-[hsl(var(--rakubun-border))] bg-[hsl(var(--rakubun-bg))] text-[hsl(var(--rakubun-text))] hover:bg-[hsl(var(--rakubun-bg-secondary))] rounded-lg font-medium transition-colors',
    socialButtonsBlockButtonText: 'font-medium',

    // Divider
    dividerLine: 'bg-[hsl(var(--rakubun-border))]',
    dividerText: 'text-[hsl(var(--rakubun-text-secondary))]',

    // Footer
    footerActionLink:
      'text-[hsl(220,100%,59%)] hover:text-[hsl(220,100%,52%)] font-medium transition-colors',
    footerActionText: 'text-[hsl(var(--rakubun-text-secondary))]',

    // Misc
    identityPreview: 'bg-[hsl(var(--rakubun-bg))] border-[hsl(var(--rakubun-border))]',
    identityPreviewText: 'text-[hsl(var(--rakubun-text))]',
    identityPreviewEditButton: 'text-[hsl(220,100%,59%)]',

    // User button & profile
    userButtonAvatarBox: 'w-8 h-8',
    userButtonPopoverCard:
      'bg-[hsl(var(--rakubun-surface))] border-[hsl(var(--rakubun-border))] shadow-card rounded-xl',
    userButtonPopoverActionButton:
      'text-[hsl(var(--rakubun-text))] hover:bg-[hsl(var(--rakubun-bg-secondary))]',
    userButtonPopoverActionButtonText: 'text-[hsl(var(--rakubun-text))]',
    userButtonPopoverFooter: 'hidden',

    // Alerts
    alertText: 'text-[hsl(var(--rakubun-text))]',

    // OTP input
    otpCodeFieldInput:
      'border-[hsl(var(--rakubun-border))] text-[hsl(var(--rakubun-text))] bg-[hsl(var(--rakubun-bg))]',

    // Internal elements
    formFieldAction: 'text-[hsl(220,100%,59%)]',
    formFieldHintText: 'text-[hsl(var(--rakubun-text-secondary))]',
    formFieldErrorText: 'text-[hsl(0,84%,60%)]',
  },
};
