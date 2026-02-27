import React, { useRef, useCallback, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { PO_TOKEN_HTML } from './potoken-html';
import { fetchChallenge, fetchIntegrityToken } from './potoken-service';

// --- Module-level state (singleton) ---

type PendingMint = { resolve: (t: string) => void; reject: (e: Error) => void };

let _integrityToken: any = null;
let _webViewRef: WebView | null = null;
let _pendingMints = new Map<string, PendingMint>();
let _initResolve: (() => void) | null = null;
let _initPromise: Promise<void> | null = null;
let _initialized = false;

function resetInit() {
  _initialized = false;
  _integrityToken = null;
  _initPromise = new Promise<void>((resolve) => {
    _initResolve = resolve;
  });
}

resetInit();

// --- Public API ---

export async function mintPoToken(identifier: string): Promise<string> {
  if (_initPromise) await _initPromise;
  if (!_initialized || !_integrityToken || !_webViewRef) {
    throw new Error('PoToken system not initialized');
  }

  const mintId = Math.random().toString(36).slice(2);

  return new Promise<string>((resolve, reject) => {
    _pendingMints.set(mintId, { resolve, reject });

    // Use injectJavaScript instead of postMessage (more reliable)
    const js = `
      (function() {
        try {
          mintToken(window._wps, ${JSON.stringify(_integrityToken)}, ${JSON.stringify(identifier)})
            .then(function(token) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MINT_OK', mintId: ${JSON.stringify(mintId)}, poToken: token
              }));
            })
            .catch(function(err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MINT_ERROR', mintId: ${JSON.stringify(mintId)}, error: String(err.message || err)
              }));
            });
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MINT_ERROR', mintId: ${JSON.stringify(mintId)}, error: String(e.message || e)
          }));
        }
      })(); true;
    `;
    _webViewRef!.injectJavaScript(js);

    setTimeout(() => {
      if (_pendingMints.has(mintId)) {
        _pendingMints.delete(mintId);
        reject(new Error('Mint timeout (10s)'));
      }
    }, 10000);
  });
}

export function isPoTokenReady(): boolean {
  return _initialized;
}

// --- YouTube API call via WebView (Chrome TLS stack) ---
// YouTube blocks API calls from OkHttp/RN fetch due to TLS fingerprinting.
// By making the call from the WebView, we use Chrome's real TLS stack.

type PendingApiCall = { resolve: (data: any) => void; reject: (e: Error) => void };
let _pendingApiCalls = new Map<string, PendingApiCall>();

let _cookiesEstablished = false;
let _visitorData: string | null = null;
let _sessionPromise: Promise<void> | null = null;

export function getVisitorData(): string | null {
  return _visitorData;
}

// Establish YouTube session (cookies + visitorData) before making API calls.
// Returns a promise that resolves once visitorData is extracted.
export function ensureYouTubeSession(): Promise<void> {
  if (_cookiesEstablished && _visitorData) return Promise.resolve();
  if (_sessionPromise) return _sessionPromise;
  if (!_webViewRef) return Promise.reject(new Error('WebView not ready'));

  _sessionPromise = new Promise<void>((resolve, reject) => {
    const js = `
      (function() {
        fetch('https://www.youtube.com/', { credentials: 'include' })
          .then(function(r) { return r.text(); })
          .then(function(html) {
            var match = html.match(/"VISITOR_DATA"\\s*:\\s*"([^"]+)"/);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSION_READY',
              visitorData: (match && match[1]) ? match[1] : null
            }));
          })
          .catch(function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSION_READY', visitorData: null, error: String(e.message || e)
            }));
          });
      })(); true;
    `;

    // Store resolve so onMessage can call it
    _sessionResolve = resolve;

    _webViewRef!.injectJavaScript(js);
    _cookiesEstablished = true;

    setTimeout(() => {
      // Resolve even on timeout — caller can proceed without visitorData
      _sessionResolve = null;
      _sessionPromise = null;
      resolve();
    }, 10000);
  });

  return _sessionPromise;
}

let _sessionResolve: (() => void) | null = null;

export async function youtubeApiCallViaWebView(
  endpoint: string,
  body: any,
  headers: Record<string, string> = {},
): Promise<any> {
  if (!_webViewRef) throw new Error('WebView not ready');

  // Ensure session is established before any API call
  await ensureYouTubeSession();

  const callId = Math.random().toString(36).slice(2);

  return new Promise<any>((resolve, reject) => {
    _pendingApiCalls.set(callId, { resolve, reject });

    const js = `
      (function() {
        fetch(${JSON.stringify(endpoint)}, {
          method: 'POST',
          headers: ${JSON.stringify({ 'Content-Type': 'application/json', ...headers })},
          body: ${JSON.stringify(JSON.stringify(body))},
          credentials: 'include',
        })
          .then(function(r) {
            if (!r.ok) {
              return r.text().then(function(t) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'API_CALL', callId: ${JSON.stringify(callId)},
                  error: 'HTTP ' + r.status + ': ' + t.substring(0, 500)
                }));
              });
            }
            return r.json().then(function(data) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'API_CALL', callId: ${JSON.stringify(callId)},
                data: data
              }));
            });
          })
          .catch(function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'API_CALL', callId: ${JSON.stringify(callId)},
              error: String(e.message || e)
            }));
          });
      })(); true;
    `;

    _webViewRef!.injectJavaScript(js);

    setTimeout(() => {
      if (_pendingApiCalls.has(callId)) {
        _pendingApiCalls.delete(callId);
        reject(new Error('API call timeout (15s)'));
      }
    }, 15000);
  });
}

// --- React component (hidden WebView) ---

export function PoTokenProvider() {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    return () => {
      _webViewRef = null;
      resetInit();
    };
  }, []);

  const startBotGuard = useCallback(async () => {
    if (__DEV__) console.log('[potoken] WebView loaded, starting BotGuard...');

    try {
      const challenge = await fetchChallenge();

      if (__DEV__) console.log('[potoken] sending challenge to WebView, jsLen:', challenge.interpreterJavascript.length);

      // Inject the challenge data and run BotGuard via injectJavaScript
      const js = `
        (function() {
          try {
            var challengeData = ${JSON.stringify(challenge)};
            runBotGuard(challengeData)
              .then(function(result) {
                window._wps = result.webPoSignalOutput;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BOTGUARD_OK',
                  botguardResponse: result.botguardResponse
                }));
              })
              .catch(function(err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BOTGUARD_ERROR',
                  error: String(err.message || err)
                }));
              });
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'BOTGUARD_ERROR',
              error: 'inject: ' + String(e.message || e)
            }));
          }
        })(); true;
      `;
      webViewRef.current?.injectJavaScript(js);
    } catch (e: any) {
      console.error('[potoken] challenge fetch failed:', e?.message);
    }
  }, []);

  const onMessage = useCallback(async (event: any) => {
    let data: any;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (__DEV__) console.log('[potoken] msg:', data.type, data.error ?? '');

    switch (data.type) {
      case 'BOTGUARD_OK': {
        try {
          if (__DEV__) console.log('[potoken] BotGuard OK, fetching integrity token...');
          const token = await fetchIntegrityToken(data.botguardResponse);
          _integrityToken = token;
          _initialized = true;
          _initResolve?.();
          if (__DEV__) console.log('[potoken] READY — can mint tokens');
        } catch (e: any) {
          console.error('[potoken] integrity token failed:', e?.message);
        }
        break;
      }

      case 'BOTGUARD_ERROR': {
        console.error('[potoken] BotGuard error:', data.error);
        break;
      }

      case 'MINT_OK': {
        const pending = _pendingMints.get(data.mintId);
        if (pending) {
          _pendingMints.delete(data.mintId);
          pending.resolve(data.poToken);
          if (__DEV__) console.log('[potoken] minted token, length:', data.poToken?.length);
        }
        break;
      }

      case 'MINT_ERROR': {
        const pending = _pendingMints.get(data.mintId);
        if (pending) {
          _pendingMints.delete(data.mintId);
          pending.reject(new Error(data.error));
        } else {
          console.error('[potoken] mint error (no pending):', data.error);
        }
        break;
      }

      case 'SESSION_READY': {
        if (data.visitorData) {
          _visitorData = data.visitorData;
          if (__DEV__) console.log('[potoken] got visitorData, length:', data.visitorData.length);
        } else {
          if (__DEV__) console.warn('[potoken] session ready but no visitorData', data.error ?? '');
        }
        _sessionResolve?.();
        _sessionResolve = null;
        break;
      }

      case 'API_CALL': {
        const call = _pendingApiCalls.get(data.callId);
        if (call) {
          _pendingApiCalls.delete(data.callId);
          if (data.error) {
            call.reject(new Error(data.error));
          } else {
            call.resolve(data.data);
          }
        }
        break;
      }
    }
  }, []);

  return (
    <View style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }}>
      <WebView
        ref={(ref) => {
          (webViewRef as any).current = ref;
          _webViewRef = ref;
        }}
        source={{ html: PO_TOKEN_HTML, baseUrl: 'https://www.youtube.com' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        onLoadEnd={startBotGuard}
        userAgent={Platform.select({
          ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          default: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        })}
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
      />
    </View>
  );
}
