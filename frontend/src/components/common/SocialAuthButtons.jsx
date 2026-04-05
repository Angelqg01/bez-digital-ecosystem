/**
 * SocialAuthButtons
 * Full-width social sign-in buttons: Google + GitHub + LinkedIn
 * Uses the shared OAuthButtons component.
 */
import React from 'react';
import OAuthButtons from './OAuthButtons';

export default function SocialAuthButtons({ onError, onSuccess }) {
    return (
        <OAuthButtons
            mode="login"
            onSuccess={onSuccess}
            onError={onError}
        />
    );
}
