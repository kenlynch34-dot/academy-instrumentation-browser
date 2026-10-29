/** Manage a session in the browser using window.localStorage so that
 * every tab of the same browser shares one session. Each tab also gets its
 * own tab id in window.sessionStorage, so tabs can still be told apart.
 */

// constants
export const EXPIRE_AFTER_MS = 1000 * 60 * 5;
export const EXPIRE_AFTER_KEY = 'session.expireAfter';
export const SESSION_KEY = 'session.id';
export const TAB_KEY = 'browser.tab.id';

// implementation

/**
 * Get (and optionally re-generate) a sessionId UUID from the localStorage.
 * This is used by the HoneycombWebSDK in our main.ts file to
 * manage a session id for our browser session.
 *
 * The session time is hardcoded in this example to last no longer than
 * 5 minutes without a call to `updateExpireTime` below, from any tab.
 * Once the session expires, a new sessionId is generated and held in
 * local storage.
 *
 * Side effect: updates sessionId in localStorage when
 * generating a new sessionId.
 *
 * Side effect: the session.expireAfter key in localStorage is updated
 * whenever we expire a session (or if we generate it on the first
 * call of this method) by calling `updateExpireTime` below.
 */
export function getSession() : string {
    const sessionId = window.localStorage.getItem(SESSION_KEY);

    // if either we don't have session.id or session.expireAfter in localStorage,
    // or we've passed the threshold to expire the session, create a new session
    // and set the expireAfter to now plus EXPIRE_AFTER_MS in time
    if (!sessionId || isSessionExpired()) {
        // create the session
        const newSessionId = crypto.randomUUID();
        window.localStorage.setItem(SESSION_KEY, newSessionId)

        // set the expiration time
        updateExpireTime();
        return newSessionId;
    }
    return sessionId;
}

export function isSessionExpired(): boolean {
    const expireAfter = window.localStorage.getItem(EXPIRE_AFTER_KEY);
    return !expireAfter || Number.parseInt(expireAfter, 10) < Date.now()
}

/**
 * A function that sets an expiration time EXPIRE_AFTER_MS milliseconds in the future
 * and stores it in `session.expireAfter` as a epoch-based number.
 */
export function updateExpireTime(afterMS?: number) : number {
    // if passed in (for testing), set the value sent. Otherwise expire by default setting
    const expireAfterMS = Date.now() + (afterMS ? afterMS : EXPIRE_AFTER_MS);
    window.localStorage.setItem(EXPIRE_AFTER_KEY, expireAfterMS.toString());
    return expireAfterMS;
}

/**
 * Get a UUID that identifies this tab. It lives in sessionStorage, so it
 * is unique per tab and never expires while the tab is open.
 */
export function getTabId() : string {
    const tabId = window.sessionStorage.getItem(TAB_KEY);
    if (tabId) return tabId;
    const newTabId = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_KEY, newTabId);
    return newTabId;
}
