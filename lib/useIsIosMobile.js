'use client';

import { useEffect, useState } from 'react';
import MobileDetect from 'mobile-detect';

export function useIsIOSMobile() {
  const [isIOSMobile, setIsIOSMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const md = new MobileDetect(window.navigator.userAgent);
      const isMobile = md.mobile() !== null;
      const isIOS = md.os() === 'iOS';

      setIsIOSMobile(isMobile && isIOS);
    }
  }, []);

  return isIOSMobile;
}
