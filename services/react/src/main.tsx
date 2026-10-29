import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HoneycombWebSDK } from '@honeycombio/opentelemetry-web'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import './index.css'
import App from './App.tsx'
import { features } from './features'
import {getSession, getTabId} from './session-management'
import {getUserName} from './user-identity'

const sdk = new HoneycombWebSDK({
  apiKey: import.meta.env.HONEYCOMB_API_KEY,
  serviceName: 'academy-instrumentation-browser',
  instrumentations: [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': {
        // copy the user's typed phrase from the request body onto the HTTP POST span
        applyCustomAttributesOnSpan: (span, request) => {
          const body = (request as RequestInit).body;
          if (typeof body !== 'string') return;
          try {
            const { phrase } = JSON.parse(body);
            if (phrase) span.setAttribute('feature.textinput', phrase);
          } catch {
            // body wasn't JSON; nothing to record
          }
        },
      },
    })
  ],
  sessionProvider: {
    getSessionId: () => { return getSession(); }
      },
  resourceAttributes: { // Data in this object is applied to every trace emitted.
      "feature_flag.key": "ALLOW_USER_QUESTIONS", // Specific to your app.
      "feature_flag.result.variant": features.ALLOW_USER_QUESTIONS, // Specific to your app.
      "user.name": getUserName(),
      "browser.tab.id": getTabId(),
      },
  debug: true,
})
sdk.start()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
