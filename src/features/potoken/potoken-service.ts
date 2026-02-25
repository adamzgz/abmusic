// PO Token service — uses bgutils-js to parse BotGuard challenges.

import { BG, GOOG_API_KEY } from 'bgutils-js';

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
const CREATE_URL = 'https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/Create';
const GENERATE_IT_URL = 'https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/GenerateIT';

const HEADERS = {
  'content-type': 'application/json+protobuf',
  'x-goog-api-key': GOOG_API_KEY,
  'x-user-agent': 'grpc-web-javascript/0.1',
};

export interface ChallengeData {
  interpreterJavascript: string;
  program: string;
  globalName: string;
}

// Fetch challenge from Google API and parse with bgutils-js
export async function fetchChallenge(): Promise<ChallengeData> {
  if (__DEV__) console.log('[potoken] fetching challenge...');

  const resp = await fetch(CREATE_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify([REQUEST_KEY]),
  });

  if (!resp.ok) throw new Error(`Challenge fetch failed: ${resp.status}`);

  const rawData = await resp.json();

  // Use bgutils-js to descramble + parse the challenge
  const challenge = BG.Challenge.parseChallengeData(rawData);

  if (!challenge) throw new Error('parseChallengeData returned null');

  const inlineJs: string | null =
    challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue ?? null;
  const interpreterUrl: string | null =
    challenge.interpreterJavascript?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue ?? null;

  if (__DEV__) {
    console.log('[potoken] parsed challenge:',
      'inlineJs:', inlineJs?.length ?? 0,
      'url:', interpreterUrl?.substring(0, 80),
      'program:', typeof challenge.program,
      'globalName:', challenge.globalName);
  }

  // Get the interpreter JS — either inline or fetch from URL
  let jsCode = inlineJs ?? '';

  if (!jsCode && interpreterUrl) {
    if (__DEV__) console.log('[potoken] fetching interpreter from URL...');
    const jsResp = await fetch(interpreterUrl);
    if (!jsResp.ok) throw new Error(`Interpreter fetch failed: ${jsResp.status}`);
    jsCode = await jsResp.text();
    if (__DEV__) console.log('[potoken] interpreter fetched, length:', jsCode.length);
  }

  if (!jsCode) throw new Error('No interpreter JS available (neither inline nor URL)');

  return {
    interpreterJavascript: jsCode,
    program: challenge.program,
    globalName: challenge.globalName,
  };
}

// Send BotGuard response to get an integrity token
export async function fetchIntegrityToken(botguardResponse: string): Promise<any> {
  if (__DEV__) console.log('[potoken] fetching integrity token...');

  const resp = await fetch(GENERATE_IT_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });

  if (!resp.ok) throw new Error(`GenerateIT failed: ${resp.status}`);

  const data = await resp.json();

  if (__DEV__) console.log('[potoken] GenerateIT response:', JSON.stringify(data).substring(0, 200));

  if (!Array.isArray(data) || typeof data[0] !== 'string') {
    throw new Error('Invalid GenerateIT response');
  }

  // Return the FULL array — BgUtils WebPoMinter expects the complete response
  return data;
}
