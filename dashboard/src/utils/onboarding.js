/**
 * Lightweight localStorage helpers for the onboarding flag.
 *
 * Lives in /utils/ rather than /pages/Onboarding.jsx so App.jsx can read
 * the flag without pulling the whole Onboarding component into the main
 * bundle. The Onboarding page itself is lazy-loaded and only fetched
 * when actually shown.
 */
const ONBOARDING_FLAG = 'engram.onboarding.completed';

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_FLAG, 'true');
}

export function isOnboardingCompleted() {
  return localStorage.getItem(ONBOARDING_FLAG) === 'true';
}
