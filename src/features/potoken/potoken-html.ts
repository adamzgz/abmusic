// HTML for the hidden WebView that runs BotGuard.
// Functions are called via injectJavaScript from React Native.

export const PO_TOKEN_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><script>

function runBotGuard(challengeData) {
  // Execute the interpreter JS — defines the BotGuard VM global
  if (challengeData.interpreterJavascript) {
    new Function(challengeData.interpreterJavascript)();
  } else {
    throw new Error('No interpreter JS');
  }

  var vm = window[challengeData.globalName];
  if (!vm || !vm.a) throw new Error('BotGuard VM not found: ' + challengeData.globalName);

  // CRITICAL: webPoSignalOutput must be the SAME array reference passed to
  // both vm.a() and asyncSnapshotFunction — this is how bgutils-js does it.
  var webPoSignalOutput = [];

  var vmFunctions = {};
  var vmCallback = function(asyncFn, shutdownFn) {
    vmFunctions.asyncSnapshotFunction = asyncFn;
    vmFunctions.shutdownFunction = shutdownFn;
  };

  // Pass webPoSignalOutput as 2nd element of last arg — BotGuard populates it
  vm.a(challengeData.program, vmCallback, true, undefined, function(){}, [[], webPoSignalOutput]);

  return new Promise(function(resolve, reject) {
    var elapsed = 0;
    var interval = setInterval(function() {
      if (vmFunctions.asyncSnapshotFunction) {
        clearInterval(interval);
        resolve();
      }
      elapsed++;
      if (elapsed >= 10000) {
        clearInterval(interval);
        reject(new Error('BotGuard init timeout after 10s'));
      }
    }, 1);
  }).then(function() {
    return new Promise(function(resolve, reject) {
      var timeout = setTimeout(function() {
        reject(new Error('Snapshot timeout'));
      }, 15000);

      // Same webPoSignalOutput reference passed here too
      vmFunctions.asyncSnapshotFunction(function(response) {
        clearTimeout(timeout);
        resolve({
          botguardResponse: response,
          webPoSignalOutput: webPoSignalOutput
        });
      }, [undefined, undefined, webPoSignalOutput, undefined]);
    });
  });
}

// --- Token minting ---

function base64ToU8(b64) {
  var mod = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (mod.length % 4) mod += '=';
  var raw = atob(mod);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function u8ToBase64(u8) {
  var str = '';
  for (var i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i]);
  return btoa(str).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
}

function mintToken(webPoSignalOutput, integrityTokenData, identifierStr) {
  var getMinter = webPoSignalOutput[0];
  if (typeof getMinter !== 'function') throw new Error('No minter in webPoSignalOutput[0], type: ' + typeof getMinter);

  // BgUtils WebPoMinter passes the FULL GenerateIT response array to getMinter.
  // integrityTokenData is the complete array: ["base64token", 43200, 100]
  var minterResult = getMinter(integrityTokenData);
  return Promise.resolve(minterResult).then(function(mintFn) {
    if (typeof mintFn !== 'function') throw new Error('Not a mint function: ' + typeof mintFn);
    var idBytes = new TextEncoder().encode(identifierStr);
    var mintResult = mintFn(idBytes);
    return Promise.resolve(mintResult);
  }).then(function(result) {
    if (!result) throw new Error('Mint returned null');
    if (result instanceof Uint8Array) return u8ToBase64(result);
    if (typeof result === 'string') return result;
    throw new Error('Unexpected type: ' + typeof result);
  });
}

</script></head><body></body></html>`;
