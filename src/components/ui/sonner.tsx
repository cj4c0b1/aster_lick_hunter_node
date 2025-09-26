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

                  // Get all existing toasts to calculate proper stacking
                  const allToasts = Array.from(document.querySelectorAll('[data-sonner-toast]'));
                  const toastIndex = allToasts.indexOf(toastElement);

                  // Set initial state
                  gsap.set(toastElement, {
                    x: 400,
                    opacity: 0,
                    scale: 0.9,
                    transformOrigin: "center center"
                  });

                  // Animate in with staggered timing
                  gsap.to(toastElement, {
                    x: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.5,
                    ease: "back.out(1.7)",
                    delay: toastIndex * 0.1 // Stagger new toasts
                  });

                  // Update positions of existing toasts when new ones are added
                  allToasts.forEach((toast, index) => {
                    if (toast !== toastElement && index < toastIndex) {
                      gsap.to(toast, {
                        y: -(toastIndex - index) * 10, // Push existing toasts up slightly
                        duration: 0.3,
                        ease: "power2.out"
                      });
                    }
                  });
                }
              }
            }
          });

          // Handle removed toasts
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;

              // Update remaining toasts positions when one is removed
              const remainingToasts = Array.from(document.querySelectorAll('[data-sonner-toast]'));
              remainingToasts.forEach((toast, index) => {
                gsap.to(toast, {
                  y: 0, // Reset to normal position
                  duration: 0.3,
                  ease: "power2.out"
                });
              });
            }
          });
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
      expand={true}
      richColors={true}
      closeButton={true}
      {...props}
    />
  )
}

export { Toaster }
