/**
 * KICKPOINT Lightweight Performance Monitoring Utility
 *
 * Tracks, measures, and logs timing events for:
 * [HOME_01] URL REQUEST START
 * [HOME_02] SERVER REQUEST START
 * [HOME_03] ROUTE LOADER START
 * [HOME_04] FIRST SERVER DATA
 * [HOME_05] HTML READY
 * [HOME_06] FIRST CONTENTFUL PAINT
 * [HOME_07] HOME SHELL VISIBLE
 * [HOME_08] PRODUCTS REQUEST START
 * [HOME_09] PRODUCTS RECEIVED
 * [HOME_10] HOME INTERACTIVE
 */

export interface PerfTimingEvent {
  id: string;
  name: string;
  timestamp: number; // Absolute timestamp (Date.now())
  elapsedMs: number; // Elapsed ms relative to navigation/start
  details?: Record<string, unknown>;
}

export interface PerfReport {
  navigationStartTime: number;
  totalDurationMs: number;
  fcpMs: number | null;
  events: PerfTimingEvent[];
  metrics: {
    urlToShellMs: number | null;
    urlToProductsMs: number | null;
    urlToInteractiveMs: number | null;
    productsFetchDurationMs: number | null;
  };
}

class PerformanceMonitor {
  private events: Map<string, PerfTimingEvent> = new Map();
  private startTime: number =
    typeof performance !== "undefined" ? performance.timeOrigin || Date.now() : Date.now();
  private fcpObserved: number | null = null;
  private isClient = typeof window !== "undefined";

  constructor() {
    if (this.isClient) {
      this.initClientMonitoring();
    }
  }

  private initClientMonitoring() {
    // Record initial URL Request Start
    this.record("HOME_01", "URL REQUEST START", {
      url: window.location.href,
      referrer: document.referrer || "direct",
    });

    // Check Navigation Timing API if available
    try {
      const navEntries = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (navEntries && navEntries.length > 0) {
        const nav = navEntries[0];
        if (nav) {
          this.startTime = performance.timeOrigin || Date.now() - performance.now();
        }
      }
    } catch {
      // Fallback
    }

    // Measure HTML Ready
    if (document.readyState === "complete" || document.readyState === "interactive") {
      this.record("HOME_05", "HTML READY", { readyState: document.readyState });
    } else {
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          this.record("HOME_05", "HTML READY");
        },
        { once: true },
      );
    }

    // Measure FCP (First Contentful Paint)
    if ("PerformanceObserver" in window) {
      try {
        const paintObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              this.fcpObserved = Math.round(entry.startTime);
              this.record("HOME_06", "FIRST CONTENTFUL PAINT", { fcpMs: this.fcpObserved });
            }
          }
        });
        paintObserver.observe({ type: "paint", buffered: true });
      } catch {
        // PerformanceObserver for paint not supported in this environment
      }
    }

    // Expose global debug helper
    (window as unknown as { __KICKPOINT_PERF__: PerformanceMonitor }).__KICKPOINT_PERF__ = this;
  }

  /**
   * Record a milestone timing event
   */
  public record(id: string, name: string, details?: Record<string, unknown>): PerfTimingEvent {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const absNow = Date.now();
    const elapsedMs = Math.round(now);

    const event: PerfTimingEvent = {
      id,
      name,
      timestamp: absNow,
      elapsedMs,
      details,
    };

    this.events.set(id, event);

    if (this.isClient) {
      this.logToConsole(event);
    }

    return event;
  }

  /**
   * Log stylized timing event to browser console
   */
  private logToConsole(event: PerfTimingEvent) {
    const color = event.id.startsWith("HOME_") ? "#10b981" : "#3b82f6";
    const prefix = `[${event.id}]`;
    const msg = `${prefix.padEnd(11)} ${event.name.padEnd(26)} +${event.elapsedMs}ms`;

    if (event.details && Object.keys(event.details).length > 0) {
      console.log(
        `%c⚡ KP-PERF%c ${msg}`,
        `background: ${color}; color: #000; font-weight: bold; border-radius: 3px; padding: 1px 4px;`,
        "color: inherit; font-family: monospace; font-size: 11px;",
        event.details,
      );
    } else {
      console.log(
        `%c⚡ KP-PERF%c ${msg}`,
        `background: ${color}; color: #000; font-weight: bold; border-radius: 3px; padding: 1px 4px;`,
        "color: inherit; font-family: monospace; font-size: 11px;",
      );
    }
  }

  /**
   * Compile and return full performance report
   */
  public getReport(): PerfReport {
    const eventsList = Array.from(this.events.values()).sort((a, b) => a.elapsedMs - b.elapsedMs);
    const lastEvent = eventsList[eventsList.length - 1];

    const shellEvent = this.events.get("HOME_07");
    const productsStartEvent = this.events.get("HOME_08");
    const productsReceivedEvent = this.events.get("HOME_09");
    const interactiveEvent = this.events.get("HOME_10");

    const urlToShellMs = shellEvent ? shellEvent.elapsedMs : null;
    const urlToProductsMs = productsReceivedEvent ? productsReceivedEvent.elapsedMs : null;
    const urlToInteractiveMs = interactiveEvent ? interactiveEvent.elapsedMs : null;

    let productsFetchDurationMs: number | null = null;
    if (productsStartEvent && productsReceivedEvent) {
      productsFetchDurationMs = productsReceivedEvent.elapsedMs - productsStartEvent.elapsedMs;
    }

    return {
      navigationStartTime: this.startTime,
      totalDurationMs: lastEvent ? lastEvent.elapsedMs : 0,
      fcpMs: this.fcpObserved,
      events: eventsList,
      metrics: {
        urlToShellMs,
        urlToProductsMs,
        urlToInteractiveMs,
        productsFetchDurationMs,
      },
    };
  }

  /**
   * Pretty print summary table to console
   */
  public printSummary() {
    if (!this.isClient) return;

    const report = this.getReport();
    console.group(
      "%c🚀 KICKPOINT PERFORMANCE AUDIT REPORT",
      "color: #10b981; font-weight: bold; font-size: 13px;",
    );

    console.table(
      report.events.map((e) => ({
        Stage: `[${e.id}] ${e.name}`,
        "Elapsed (ms)": `${e.elapsedMs} ms`,
        Details: e.details ? JSON.stringify(e.details) : "-",
      })),
    );

    console.log(
      `%c📊 Summary Metrics:\n` +
        `  • FCP (First Contentful Paint): ${report.fcpMs ?? "N/A"} ms\n` +
        `  • URL → Home Shell Visible:     ${report.metrics.urlToShellMs ?? "N/A"} ms\n` +
        `  • URL → Products Loaded:        ${report.metrics.urlToProductsMs ?? "N/A"} ms\n` +
        `  • Products Query Duration:      ${report.metrics.productsFetchDurationMs ?? "N/A"} ms\n` +
        `  • URL → Home Interactive:       ${report.metrics.urlToInteractiveMs ?? "N/A"} ms`,
      "font-family: monospace; color: #10b981; font-size: 11px;",
    );

    console.groupEnd();
  }

  /**
   * Export performance report as JSON string
   */
  public exportJSON(): string {
    return JSON.stringify(this.getReport(), null, 2);
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Convenient shorthand helper
 */
export function trackPerf(id: string, name: string, details?: Record<string, unknown>) {
  return perfMonitor.record(id, name, details);
}
