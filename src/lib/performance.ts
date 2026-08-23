/**
 * KICKPOINT Performance Logger Singleton
 *
 * Implements milestone logging from [HOME_01] to [HOME_10]
 * using performance.now() and console.log for audit purposes.
 */

export interface MilestoneLog {
  id: string;
  name: string;
  timestamp: number;
  elapsedMs: number;
  details?: Record<string, unknown>;
}

class PerformanceLogger {
  private logs: MilestoneLog[] = [];

  private getTime(): number {
    return typeof performance !== "undefined" ? Math.round(performance.now()) : 0;
  }

  private logMilestone(id: string, name: string, details?: Record<string, unknown>): MilestoneLog {
    const elapsedMs = this.getTime();
    const entry: MilestoneLog = {
      id,
      name,
      timestamp: Date.now(),
      elapsedMs,
      details,
    };

    this.logs.push(entry);

    if (typeof window !== "undefined") {
      const formatted = `[${id}] ${name} (+${elapsedMs}ms)`;
      if (details && Object.keys(details).length > 0) {
        console.log(
          `%c[PERF]%c ${formatted}`,
          "background: #10b981; color: #000; font-weight: bold; padding: 1px 4px; border-radius: 2px;",
          "color: inherit; font-family: monospace;",
          details,
        );
      } else {
        console.log(
          `%c[PERF]%c ${formatted}`,
          "background: #10b981; color: #000; font-weight: bold; padding: 1px 4px; border-radius: 2px;",
          "color: inherit; font-family: monospace;",
        );
      }
    }

    return entry;
  }

  // Exact milestone methods log01() through log10()
  public log01(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_01", "URL REQUEST START", details);
  }

  public log02(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_02", "SERVER REQUEST START", details);
  }

  public log03(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_03", "ROUTE LOADER START", details);
  }

  public log04(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_04", "FIRST SERVER DATA", details);
  }

  public log05(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_05", "HTML READY", details);
  }

  public log06(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_06", "FIRST CONTENTFUL PAINT", details);
  }

  public log07(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_07", "HOME SHELL VISIBLE", details);
  }

  public log08(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_08", "PRODUCTS REQUEST START", details);
  }

  public log09(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_09", "PRODUCTS RECEIVED", details);
  }

  public log10(details?: Record<string, unknown>) {
    return this.logMilestone("HOME_10", "HOME INTERACTIVE", details);
  }

  // Named aliases for convenience
  public home01UrlRequestStart(details?: Record<string, unknown>) {
    return this.log01(details);
  }

  public home02ServerRequestStart(details?: Record<string, unknown>) {
    return this.log02(details);
  }

  public home03RouteLoaderStart(details?: Record<string, unknown>) {
    return this.log03(details);
  }

  public home04FirstServerData(details?: Record<string, unknown>) {
    return this.log04(details);
  }

  public home05HtmlReady(details?: Record<string, unknown>) {
    return this.log05(details);
  }

  public home06FirstContentfulPaint(details?: Record<string, unknown>) {
    return this.log06(details);
  }

  public home07HomeShellVisible(details?: Record<string, unknown>) {
    return this.log07(details);
  }

  public home08ProductsRequestStart(details?: Record<string, unknown>) {
    return this.log08(details);
  }

  public home09ProductsReceived(details?: Record<string, unknown>) {
    return this.log09(details);
  }

  public home10HomeInteractive(details?: Record<string, unknown>) {
    return this.log10(details);
  }

  // Utility methods
  public getLogs(): MilestoneLog[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
  }

  public printSummary() {
    if (typeof console !== "undefined" && console.table) {
      console.group("%c🚀 KICKPOINT PERF MILESTONES SUMMARY", "color: #10b981; font-weight: bold;");
      console.table(
        this.logs.map((l) => ({
          Milestone: `[${l.id}] ${l.name}`,
          "Time (ms)": `${l.elapsedMs} ms`,
          Details: l.details ? JSON.stringify(l.details) : "-",
        })),
      );
      console.groupEnd();
    }
  }
}

export const perf = new PerformanceLogger();
export default perf;
