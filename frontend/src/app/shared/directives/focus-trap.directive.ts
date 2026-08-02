import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps Tab focus inside the host element while it exists, and restores
 * focus to whatever was focused before it opened. Required for WCAG 2.4.3
 * on any modal or overlay.
 */
@Directive({ selector: '[acmsFocusTrap]', standalone: true })
export class FocusTrapDirective implements AfterViewInit, OnDestroy {
  /**
   * The generic goes on the PROPERTY, not on inject()'s call site.
   * inject(ElementRef<HTMLElement>) was silently resolving to `any` in this
   * project's TS setup, which is what produced TS2347 on every generic call
   * made against `.nativeElement` below. This form is the reliable one.
   */
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private previous: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.previous = document.activeElement as HTMLElement | null;
    const first = this.items()[0] ?? this.host.nativeElement;
    queueMicrotask(() => first.focus());
    document.addEventListener('keydown', this.onKeydown, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeydown, true);
    this.previous?.focus();
  }

  private items(): HTMLElement[] {
    const nodeList = this.host.nativeElement.querySelectorAll(FOCUSABLE);
    const all: HTMLElement[] = Array.prototype.slice.call(nodeList);
    return all.filter((el: HTMLElement) => el.offsetParent !== null);
  }

  /**
   * Typed against the generic Event, not KeyboardEvent, so this satisfies
   * addEventListener's expected EventListenerOrEventListenerObject shape
   * under strictFunctionTypes. Narrowing happens inside the body instead.
   */
  private readonly onKeydown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Tab') return;

    const items = this.items();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !this.host.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
}