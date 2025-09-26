"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"
import { useEffect } from "react"
import { gsap } from "gsap"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  useEffect(() => {
    // Set up GSAP animations for Sonner toasts
    const setupToastAnimations = () => {
      // Create a MutationObserver to watch for new toasts
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;

              // Check if this is a toast element
              if (element.matches('[data-sonner-toast]') ||
                  element.querySelector('[data-sonner-toast]')) {

                const toastElement = element.matches('[data-sonner-toast]')
                  ? element
                  : element.querySelector('[data-sonner-toast]') as HTMLElement;

                if (toastElement && !toastElement.hasAttribute('data-animated')) {
                  toastElement.setAttribute('data-animated', 'true');

                  // Set initial state for slide-in animation
                  gsap.set(toastElement, {
                    x: 400,
                    opacity: 0,
                    scale: 0.95,
                    transformOrigin: "center center"
                  });

                  // Animate in with smooth slide
                  gsap.to(toastElement, {
                    x: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.4,
                    ease: "power3.out"
                  });
                }
              }
            }
          });

          // Handle removed toasts - no special animation needed
          // Sonner handles the positioning internally with the gap prop
        });
      });

      // Start observing the toaster container
      const toasterContainer = document.querySelector('[data-sonner-toaster]');
      if (toasterContainer) {
        observer.observe(toasterContainer, {
          childList: true,
          subtree: true
        });
      }

      return () => observer.disconnect();
    };

    // Set up animations after a short delay to ensure Sonner is mounted
    const timer = setTimeout(setupToastAnimations, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          transform: "translateX(0)", // Ensure transforms work with GSAP
        },
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      position="top-right"
      expand={false}
      richColors={true}
      closeButton={true}
      gap={8}
      visibleToasts={10}
      {...props}
    />
  )
}

export { Toaster }
