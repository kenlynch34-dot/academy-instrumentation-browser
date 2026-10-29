/** Give each browser a stable, friendly user name kept in localStorage,
 * so it survives new tabs, reloads and expired sessions.
 */
export const USER_KEY = 'user.name';

const ADJECTIVES = ['brave', 'calm', 'eager', 'fuzzy', 'jolly', 'lucky', 'quiet', 'witty'];
const ANIMALS = ['otter', 'panda', 'falcon', 'gecko', 'koala', 'lynx', 'walrus', 'yak'];

function pick<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export function getUserName(): string {
    try {
        const existing = window.localStorage.getItem(USER_KEY);
        if (existing) return existing;
        const name = `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${Math.floor(Math.random() * 1000)}`;
        window.localStorage.setItem(USER_KEY, name);
        return name;
    } catch {
        return 'anonymous'; // storage blocked, e.g. private browsing
    }
}
