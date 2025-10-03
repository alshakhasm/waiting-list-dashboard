const KEY = 'guest_mode';
export const GUEST_EVENT = 'guest-mode-changed';

export function isGuest(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function enableGuest() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {}
  window.dispatchEvent(new Event(GUEST_EVENT));
}

export function disableGuest() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(GUEST_EVENT));
}
