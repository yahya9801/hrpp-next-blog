"use client";

import { useEffect, useRef } from "react";

const ADSENSE_BASE_SCRIPT =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
const ADSENSE_CLIENT_ID = "ca-pub-3826573131304099";

type InArticleAdProps = {
  slotId?: string;
  className?: string;
};

const SCRIPT_LOADED_ATTR = "data-adsbygoogle-loaded";

const InArticleAd = ({ slotId = "8015069158", className }: InArticleAdProps) => {
  const adRef = useRef<HTMLModElement | null>(null);
  const hasRequestedAdRef = useRef(false);
  const scriptReadyRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const adElement = adRef.current;

    if (!adElement) {
      return;
    }

    hasRequestedAdRef.current = false;
    scriptReadyRef.current = false;

    adElement.innerHTML = "";
    adElement.removeAttribute("data-adsbygoogle-status");

    let resizeObserver: ResizeObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let rafId: number | null = null;
    let trackedScript: HTMLScriptElement | null = document.querySelector<
      HTMLScriptElement
    >(`script[src^="${ADSENSE_BASE_SCRIPT}"]`);
    let resizeListenerCleanup: (() => void) | null = null;
    let fallbackTimeout: number | null = null;

    const setScriptReady = () => {
      scriptReadyRef.current = true;
      if (trackedScript) {
        trackedScript.setAttribute(SCRIPT_LOADED_ATTR, "true");
      }
      attemptRequest();
    };

    const attemptRequest = () => {
      if (
        hasRequestedAdRef.current ||
        !scriptReadyRef.current ||
        !adRef.current
      ) {
        return;
      }

      const width = adRef.current.offsetWidth;

      if (width <= 0) {
        return;
      }

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        hasRequestedAdRef.current = true;
      } catch (error) {
        console.error("AdSense push error:", error);
      }
    };

    const ensureScript = () => {
      if (typeof window.adsbygoogle !== "undefined") {
        scriptReadyRef.current = true;
        attemptRequest();
        return;
      }

      if (
        trackedScript &&
        trackedScript.getAttribute(SCRIPT_LOADED_ATTR) === "true"
      ) {
        scriptReadyRef.current = true;
        attemptRequest();
        return;
      }

      const handleLoad = () => {
        trackedScript?.removeEventListener("load", handleLoad);
        setScriptReady();
      };

      if (trackedScript) {
        trackedScript.addEventListener("load", handleLoad, { once: true });
      } else {
        trackedScript = document.createElement("script");
        trackedScript.src = `${ADSENSE_BASE_SCRIPT}?client=${ADSENSE_CLIENT_ID}`;
        trackedScript.async = true;
        trackedScript.crossOrigin = "anonymous";
        trackedScript.addEventListener("load", handleLoad, { once: true });
        document.head.appendChild(trackedScript);
      }

      return () => {
        trackedScript?.removeEventListener("load", handleLoad);
      };
    };

    const cleanupScriptListener = ensureScript();

    if (typeof window.ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        if (!scriptReadyRef.current) {
          return;
        }
        attemptRequest();
      });
      resizeObserver.observe(adElement);
    } else {
      const handleResize = () => {
        if (!scriptReadyRef.current) {
          return;
        }
        attemptRequest();
      };
      window.addEventListener("resize", handleResize);
      resizeListenerCleanup = () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    if (typeof window.IntersectionObserver === "function") {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && scriptReadyRef.current) {
              attemptRequest();
            }
          });
        },
        { rootMargin: "200px 0px" },
      );
      visibilityObserver.observe(adElement);
    } else {
      const handleScroll = () => {
        if (!scriptReadyRef.current) {
          return;
        }
        attemptRequest();
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      visibilityObserver = {
        disconnect() {
          window.removeEventListener("scroll", handleScroll);
        },
      } as unknown as IntersectionObserver;
    }

    rafId = window.requestAnimationFrame(() => {
      if (scriptReadyRef.current) {
        attemptRequest();
      }
    });

    fallbackTimeout = window.setTimeout(() => {
      if (scriptReadyRef.current) {
        attemptRequest();
      }
    }, 1500);

    return () => {
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      resizeListenerCleanup?.();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (fallbackTimeout) {
        window.clearTimeout(fallbackTimeout);
      }
      cleanupScriptListener?.();
    };
  }, [slotId]);

  const wrapperClassName = ["flex justify-center", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: "block",
          textAlign: "center",
          width: "100%",
          minHeight: "200px",
        }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
      />
    </div>
  );
};

export default InArticleAd;
