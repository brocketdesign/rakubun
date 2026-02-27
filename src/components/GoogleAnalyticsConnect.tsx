import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { 
  BarChart3, 
  Link2, 
  Unlink, 
  ChevronDown, 
  Check, 
  Loader2, 
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../i18n';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  analyticsActions,
  useAnalyticsProperties,
  useAnalyticsPropertiesLoading,
  useAnalyticsConnectionStatus,
  useAnalyticsConnectionStatusLoading,
} from '../stores/analyticsStore';

interface GoogleAnalyticsConnectProps {
  siteId: string;
  siteName: string;
  variant?: 'default' | 'compact' | 'card';
}

export default function GoogleAnalyticsConnect({ 
  siteId, 
  siteName,
  variant = 'default' 
}: GoogleAnalyticsConnectProps) {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  
  const properties = useAnalyticsProperties();
  const propertiesLoading = useAnalyticsPropertiesLoading();
  const connectionStatus = useAnalyticsConnectionStatus(siteId);
  const statusLoading = useAnalyticsConnectionStatusLoading(siteId);

  // Load connection status on mount
  useEffect(() => {
    if (siteId) {
      analyticsActions.loadConnectionStatus(getToken, siteId);
    }
  }, [siteId, getToken]);

  // Handle OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gaAuth = params.get('ga_auth');
    const callbackSiteId = params.get('siteId');
    
    if (gaAuth === 'success' && callbackSiteId === siteId) {
      // Clear query params
      window.history.replaceState({}, '', window.location.pathname);
      // Load properties and show dialog
      loadProperties();
      setShowPropertyDialog(true);
      toast.success(language === 'en' ? 'Google account connected!' : 'Googleアカウントが接続されました！');
    }
  }, [siteId, language]);

  const loadProperties = useCallback(async () => {
    await analyticsActions.loadProperties(getToken, siteId);
  }, [getToken, siteId]);

  const handleInitiateOAuth = () => {
    // Redirect to OAuth endpoint
    const oauthUrl = `/api/analytics/oauth?siteId=${siteId}`;
    window.location.href = oauthUrl;
  };

  const handleConnectProperty = async () => {
    if (!selectedProperty) return;
    
    setIsConnecting(true);
    try {
      await analyticsActions.connectProperty(getToken, siteId, selectedProperty);
      setShowPropertyDialog(false);
      toast.success(language === 'en' ? 'Google Analytics connected!' : 'Google Analyticsが接続されました！');
    } catch (err) {
      toast.error(language === 'en' ? 'Failed to connect property' : 'プロパティの接続に失敗しました');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await analyticsActions.disconnectProperty(getToken, siteId);
      toast.success(language === 'en' ? 'Google Analytics disconnected' : 'Google Analyticsの接続を解除しました');
    } catch (err) {
      toast.error(language === 'en' ? 'Failed to disconnect' : '接続解除に失敗しました');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshStatus = () => {
    analyticsActions.loadConnectionStatus(getToken, siteId);
    toast.info(language === 'en' ? 'Refreshing status...' : 'ステータスを更新中...');
  };

  // Compact variant (for tables/lists)
  if (variant === 'compact') {
    if (statusLoading) {
      return (
        <div className="flex items-center gap-2 text-rakubun-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">{language === 'en' ? 'Loading...' : '読み込み中...'}</span>
        </div>
      );
    }

    if (connectionStatus?.connected) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-medium truncate max-w-[150px]">
              {connectionStatus.propertyName || 'GA Connected'}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="p-1 rounded hover:bg-red-50 text-rakubun-text-secondary hover:text-red-500 transition-colors"
            title={language === 'en' ? 'Disconnect' : '接続解除'}
          >
            {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={handleInitiateOAuth}
        className="inline-flex items-center gap-1.5 text-xs text-rakubun-accent hover:text-rakubun-accent/80 transition-colors"
      >
        <Link2 className="w-3.5 h-3.5" />
        {language === 'en' ? 'Connect GA' : 'GAを接続'}
      </button>
    );
  }

  // Card variant (for settings page)
  if (variant === 'card') {
    return (
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${connectionStatus?.connected ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rakubun-bg-secondary'}`}>
              <BarChart3 className={`w-5 h-5 ${connectionStatus?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rakubun-text-secondary'}`} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rakubun-text">
                {language === 'en' ? 'Google Analytics' : 'Google Analytics'}
              </h4>
              <p className="text-xs text-rakubun-text-secondary mt-0.5">
                {connectionStatus?.connected 
                  ? (language === 'en' ? `Connected to ${connectionStatus.propertyName}` : `${connectionStatus.propertyName}に接続中`)
                  : (language === 'en' ? 'Track your site performance with GA4' : 'GA4でサイトパフォーマンスを追跡')
                }
              </p>
            </div>
          </div>
          
          {statusLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-rakubun-text-secondary" />
          ) : connectionStatus?.connected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshStatus}
                className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                title={language === 'en' ? 'Refresh' : '更新'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="btn-secondary text-xs"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Disconnect' : '接続解除'}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleInitiateOAuth}
              className="btn-primary text-xs"
            >
              <Link2 className="w-3.5 h-3.5" />
              {language === 'en' ? 'Connect' : '接続'}
            </button>
          )}
        </div>

        {connectionStatus?.connected && (
          <div className="mt-4 pt-4 border-t border-rakubun-border">
            <div className="flex items-center gap-2 text-xs text-rakubun-text-secondary">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {language === 'en' 
                  ? `Property ID: ${connectionStatus.propertyId}` 
                  : `プロパティID: ${connectionStatus.propertyId}`}
              </span>
            </div>
          </div>
        )}

        {/* Property Selection Dialog */}
        <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === 'en' ? 'Select GA4 Property' : 'GA4プロパティを選択'}
              </DialogTitle>
              <DialogDescription>
                {language === 'en' 
                  ? `Choose which Google Analytics property to connect to ${siteName}` 
                  : `${siteName}に接続するGoogle Analyticsプロパティを選択してください`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {propertiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
                </div>
              ) : properties.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-rakubun-text">
                    {language === 'en' ? 'No GA4 properties found' : 'GA4プロパティが見つかりません'}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-1">
                    {language === 'en' 
                      ? 'Make sure you have GA4 properties in your Google account' 
                      : 'GoogleアカウントにGA4プロパティがあることを確認してください'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {properties.map((property) => (
                    <button
                      key={property.id}
                      onClick={() => setSelectedProperty(property.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        selectedProperty === property.id
                          ? 'border-rakubun-accent bg-rakubun-accent/5'
                          : 'border-rakubun-border hover:border-rakubun-accent/50'
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium text-rakubun-text">{property.name}</p>
                        <p className="text-xs text-rakubun-text-secondary">{property.account}</p>
                        <p className="text-[10px] text-rakubun-text-secondary/70 font-mono mt-0.5">{property.id}</p>
                      </div>
                      {selectedProperty === property.id && (
                        <Check className="w-5 h-5 text-rakubun-accent" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPropertyDialog(false)}
                disabled={isConnecting}
              >
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </Button>
              <Button
                onClick={handleConnectProperty}
                disabled={!selectedProperty || isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {language === 'en' ? 'Connect Property' : 'プロパティを接続'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Default variant
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-rakubun-accent" />
          <div>
            <h4 className="text-sm font-semibold text-rakubun-text">
              {language === 'en' ? 'Google Analytics 4' : 'Google Analytics 4'}
            </h4>
            <p className="text-xs text-rakubun-text-secondary">
              {connectionStatus?.connected 
                ? (language === 'en' ? 'Connected' : '接続済み')
                : (language === 'en' ? 'Not connected' : '未接続')
              }
            </p>
          </div>
        </div>

        {statusLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-rakubun-text-secondary" />
        ) : connectionStatus?.connected ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
                {language === 'en' ? 'Connected' : '接続済み'}
                <ChevronDown className="w-3 h-3 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefreshStatus}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {language === 'en' ? 'Refresh Status' : 'ステータス更新'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-red-600 focus:text-red-600"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                {language === 'en' ? 'Disconnect' : '接続解除'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={handleInitiateOAuth} size="sm">
            <Link2 className="w-4 h-4 mr-1.5" />
            {language === 'en' ? 'Connect' : '接続'}
          </Button>
        )}
      </div>

      {connectionStatus?.connected && connectionStatus.propertyName && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            {connectionStatus.propertyName}
          </span>
          <span className="text-xs text-emerald-600/70 font-mono ml-auto">
            {connectionStatus.propertyId}
          </span>
        </div>
      )}

      {/* Property Selection Dialog */}
      <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'en' ? 'Select GA4 Property' : 'GA4プロパティを選択'}
            </DialogTitle>
            <DialogDescription>
              {language === 'en' 
                ? `Choose which Google Analytics property to connect to ${siteName}` 
                : `${siteName}に接続するGoogle Analyticsプロパティを選択してください`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {propertiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <p className="text-sm text-rakubun-text">
                  {language === 'en' ? 'No GA4 properties found' : 'GA4プロパティが見つかりません'}
                </p>
                <p className="text-xs text-rakubun-text-secondary mt-1">
                  {language === 'en' 
                    ? 'Make sure you have GA4 properties in your Google account' 
                    : 'GoogleアカウントにGA4プロパティがあることを確認してください'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {properties.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => setSelectedProperty(property.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedProperty === property.id
                        ? 'border-rakubun-accent bg-rakubun-accent/5'
                        : 'border-rakubun-border hover:border-rakubun-accent/50'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-rakubun-text">{property.name}</p>
                      <p className="text-xs text-rakubun-text-secondary">{property.account}</p>
                      <p className="text-[10px] text-rakubun-text-secondary/70 font-mono mt-0.5">{property.id}</p>
                    </div>
                    {selectedProperty === property.id && (
                      <Check className="w-5 h-5 text-rakubun-accent" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPropertyDialog(false)}
              disabled={isConnecting}
            >
              {language === 'en' ? 'Cancel' : 'キャンセル'}
            </Button>
            <Button
              onClick={handleConnectProperty}
              disabled={!selectedProperty || isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {language === 'en' ? 'Connect Property' : 'プロパティを接続'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
