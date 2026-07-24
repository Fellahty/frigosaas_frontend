import React, { useState } from 'react';

const LOGO_AVIF = '/images/frigosmart-logo.avif';
const LOGO_SVG = '/images/frigosmart-logo.svg';
const ICON_SVG = '/images/frigosmart-icon.svg';

interface FrigoSmartLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
}

export const FrigoSmartLogo: React.FC<FrigoSmartLogoProps> = ({
  variant = 'full',
  className = '',
}) => {
  const [src, setSrc] = useState(LOGO_AVIF);

  const onError = () => {
    setSrc(variant === 'icon' ? ICON_SVG : LOGO_SVG);
  };

  if (variant === 'icon') {
    return (
      <img
        src={src}
        alt="FrigoSmart"
        onError={onError}
        className={`h-9 w-9 object-contain ${className}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt="FrigoSmart"
      onError={onError}
      className={`h-10 w-auto max-w-[220px] object-contain object-left ${className}`}
    />
  );
};
