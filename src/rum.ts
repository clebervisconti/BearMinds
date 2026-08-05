/**
 * Splunk Observability RUM — BearMinds (browser side).
 *
 * The agent is bundled from npm rather than loaded from cdn.signalfx.com. This
 * app has no COEP constraint so the CDN snippet would also work, but bundling
 * keeps the access token in exactly one place: it is injected at build time from
 * Keychain (cyberlabs-splunk-rum-token) instead of being pasted into HTML.
 *
 * Build with:
 *   VITE_SPLUNK_RUM_TOKEN="$(secret splunk-rum-token)" npm run build
 *
 * The token is a public, client-side value by design — the reason to centralise
 * it is correctness, not secrecy. Several apps currently hardcode a different
 * value than the one in Keychain; see infra/docs.
 */
import SplunkRum from '@splunk/otel-web';
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder';

const token = import.meta.env.VITE_SPLUNK_RUM_TOKEN;

if (!token) {
  // Non-fatal: missing telemetry must never break the app.
  console.warn('[rum] VITE_SPLUNK_RUM_TOKEN unset — Splunk RUM disabled for this build');
} else {
  SplunkRum.init({
    realm: 'us1',
    rumAccessToken: token,
    applicationName: 'bearminds',
    deploymentEnvironment: 'production',
  });

  SplunkSessionRecorder.init({
    realm: 'us1',
    rumAccessToken: token,
  });
}
