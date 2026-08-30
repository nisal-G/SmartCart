import { useState } from 'react';
import { classNames } from '../../utils/classNames';

function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Circular user avatar. Shows the account's OAuth profile picture (Google/
 * Facebook — see backend config/passport.js findOrCreateOAuthUser, which is
 * the only place `avatarUrl` is ever set) when one is on file, falling back
 * to an initials badge when there's no `avatarUrl`, or the image fails to
 * load (revoked/expired provider URL, offline, etc). `className` controls
 * sizing/colors and is applied to whichever of the two actually renders.
 */
export function Avatar({ name, avatarUrl, className }) {
  const [imgFailed, setImgFailed] = useState(false);

  // A picture that failed before shouldn't stay hidden forever if the user
  // later signs in with a different (working) provider photo. Adjusting
  // state during render (React's documented pattern for "reset state when a
  // prop changes") rather than in an effect, so there's no extra render.
  const [trackedAvatarUrl, setTrackedAvatarUrl] = useState(avatarUrl);
  if (avatarUrl !== trackedAvatarUrl) {
    setTrackedAvatarUrl(avatarUrl);
    setImgFailed(false);
  }

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={classNames('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={classNames('flex shrink-0 items-center justify-center rounded-full', className)}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
