import { loadConfig } from '../bot/config';
import { errorLogger } from '../services/errorLogger';
import { errorLogsDb } from '../db/errorLogsDb';

export interface BugReportConfig {
  hours?: number;
  includeSystemInfo?: boolean;
  includeConfig?: boolean;
  includeErrors?: boolean;
  includeStackTraces?: boolean;
  redactSensitive?: boolean;
  format?: 'markdown' | 'json';
}

export class BugReportGenerator {
  private static redactSensitiveData(obj: any): any {
    if (!obj) return obj;

    if (typeof obj === 'string') {
      // Redact API keys and secrets
      return obj.replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]');
    }

    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactSensitiveData(item));
    }

    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('credential')
      ) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = this.redactSensitiveData(value);
      }
    }
    return redacted;
  }

  public static async generateReport(options: BugReportConfig = {}): Promise<string> {
    const {
      hours = 24,
      includeSystemInfo = true,
      includeConfig = true,
      includeErrors = true,
      includeStackTraces = false,
      redactSensitive = true,
      format = 'markdown'
    } = options;

    if (format === 'json') {
      return this.generateJsonReport({
        hours,
        includeSystemInfo,
        includeConfig,
        includeErrors,
        redactSensitive
      });
    }

    return this.generateMarkdownReport({
      hours,
      includeSystemInfo,
      includeConfig,
      includeErrors,
      includeStackTraces,
      redactSensitive
    });
  }

  private static async generateMarkdownReport(options: BugReportConfig): Promise<string> {
    const {
      hours = 24,
      includeSystemInfo = true,
      includeConfig = true,
      includeErrors = true,
      includeStackTraces = false,
      redactSensitive = true
    } = options;

    let report = `# Bug Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Session ID:** ${errorLogger.getSessionId()}\n`;
    report += `**Time Range:** Last ${hours} hours\n\n`;

    // System Information
    if (includeSystemInfo) {
      const systemInfo = errorLogger.getSystemInfo();
      report += `## System Information\n\n`;
      report += `| Property | Value |\n`;
      report += `|----------|-------|\n`;
      report += `| Platform | ${systemInfo.platform} |\n`;
      report += `| Node Version | ${systemInfo.version} |\n`;
      report += `| Total Memory | ${(systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB |\n`;
      report += `| Used Memory | ${(systemInfo.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB |\n`;
      report += `| Free Memory | ${(systemInfo.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB |\n`;
      report += `| Uptime | ${Math.floor(systemInfo.uptime / 60)} minutes |\n\n`;
    }

    // Configuration Summary
    if (includeConfig) {
      try {
        const config = await loadConfig();
        const safeConfig = redactSensitive ? this.redactSensitiveData(config) : config;

        report += `## Configuration Summary\n\n`;
        report += `- **Paper Mode:** ${safeConfig.paperMode ? 'Enabled' : 'Disabled'}\n`;
        report += `- **Risk Percentage:** ${safeConfig.riskPercentage}%\n`;
        report += `- **Active Symbols:** ${Object.keys(safeConfig.symbols).length}\n`;
        report += `- **Symbols:** ${Object.keys(safeConfig.symbols).join(', ')}\n\n`;

        report += `<details>\n<summary>Symbol Configuration</summary>\n\n`;
        report += `\`\`\`json\n${JSON.stringify(safeConfig.symbols, null, 2)}\n\`\`\`\n`;
        report += `</details>\n\n`;
      } catch (error) {
        report += `## Configuration\n\n`;
        report += `Failed to load configuration: ${error}\n\n`;
      }
    }

    // Error Statistics
    if (includeErrors) {
      const { errors, stats } = await errorLogsDb.exportErrors(errorLogger.getSessionId(), hours);

      report += `## Error Statistics\n\n`;
      report += `| Metric | Value |\n`;
      report += `|--------|-------|\n`;
      report += `| Total Errors | ${stats.total} |\n`;
      report += `| Recent Errors (${hours}h) | ${stats.recentCount} |\n\n`;

      // By Type
      if (Object.keys(stats.byType).length > 0) {
        report += `### Errors by Type\n\n`;
        report += `| Type | Count |\n`;
        report += `|------|-------|\n`;
        Object.entries(stats.byType)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            report += `| ${type} | ${count} |\n`;
          });
        report += `\n`;
      }

      // By Severity
      if (Object.keys(stats.bySeverity).length > 0) {
        report += `### Errors by Severity\n\n`;
        report += `| Severity | Count |\n`;
        report += `|----------|-------|\n`;
        Object.entries(stats.bySeverity)
          .sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return (severityOrder[a[0] as keyof typeof severityOrder] || 4) -
                   (severityOrder[b[0] as keyof typeof severityOrder] || 4);
          })
          .forEach(([severity, count]) => {
            report += `| ${severity} | ${count} |\n`;
          });
        report += `\n`;
      }

      // Top Errors
      if (stats.topErrors.length > 0) {
        report += `### Most Frequent Errors\n\n`;
        stats.topErrors.slice(0, 5).forEach((error, index) => {
          report += `${index + 1}. **${error.message}** (${error.count} occurrences)\n`;
        });
        report += `\n`;
      }

      // Recent Error Details
      if (errors.length > 0) {
        report += `## Recent Error Details\n\n`;
        const recentErrors = errors.slice(0, 10);

        recentErrors.forEach((error, index) => {
          report += `### Error ${index + 1}\n\n`;
          report += `| Field | Value |\n`;
          report += `|-------|-------|\n`;
          report += `| Time | ${new Date(error.timestamp).toISOString()} |\n`;
          report += `| Type | ${error.error_type} |\n`;
          report += `| Severity | **${error.severity}** |\n`;
          if (error.component) report += `| Component | ${error.component} |\n`;
          if (error.symbol) report += `| Symbol | ${error.symbol} |\n`;
          if (error.error_code) report += `| Error Code | ${error.error_code} |\n`;
          if (error.user_action) report += `| User Action | ${error.user_action} |\n`;
          report += `\n`;

          report += `**Message:**\n\`\`\`\n${error.message}\n\`\`\`\n\n`;

          if (includeStackTraces && error.stack_trace) {
            report += `<details>\n<summary>Stack Trace</summary>\n\n`;
            report += `\`\`\`\n${error.stack_trace}\n\`\`\`\n`;
            report += `</details>\n\n`;
          }

          if (error.details) {
            const details = typeof error.details === 'string'
              ? JSON.parse(error.details)
              : error.details;
            const safeDetails = redactSensitive ? this.redactSensitiveData(details) : details;

            report += `<details>\n<summary>Additional Details</summary>\n\n`;
            report += `\`\`\`json\n${JSON.stringify(safeDetails, null, 2)}\n\`\`\`\n`;
            report += `</details>\n\n`;
          }
        });
      }
    }

    report += `## Steps to Reproduce\n\n`;
    report += `1. [Please describe the steps that led to this error]\n`;
    report += `2. \n`;
    report += `3. \n\n`;

    report += `## Expected Behavior\n\n`;
    report += `[Please describe what you expected to happen]\n\n`;

    report += `## Additional Context\n\n`;
    report += `[Please add any other context about the problem here]\n\n`;

    report += `---\n\n`;
    report += `*This report was automatically generated by the Error Logger system.*\n`;

    return report;
  }

  private static async generateJsonReport(options: BugReportConfig): Promise<string> {
    const {
      hours = 24,
      includeSystemInfo = true,
      includeConfig = true,
      includeErrors = true,
      redactSensitive = true
    } = options;

    const report: any = {
      generated: new Date().toISOString(),
      sessionId: errorLogger.getSessionId(),
      timeRange: `Last ${hours} hours`
    };

    if (includeSystemInfo) {
      report.systemInfo = errorLogger.getSystemInfo();
    }

    if (includeConfig) {
      try {
        const config = await loadConfig();
        report.config = redactSensitive ? this.redactSensitiveData(config) : config;
      } catch (error) {
        report.config = { error: `Failed to load: ${error}` };
      }
    }

    if (includeErrors) {
      const { errors, stats } = await errorLogsDb.exportErrors(errorLogger.getSessionId(), hours);
      report.errorStats = stats;
      report.recentErrors = errors.slice(0, 20).map(error => {
        const errorObj: any = { ...error };
        if (error.details) {
          try {
            errorObj.details = typeof error.details === 'string'
              ? JSON.parse(error.details)
              : error.details;
          } catch {}
        }
        return redactSensitive ? this.redactSensitiveData(errorObj) : errorObj;
      });
    }

    return JSON.stringify(report, null, 2);
  }

  public static async generateQuickSummary(): Promise<string> {
    const stats = await errorLogsDb.getErrorStats(1);
    const sessionErrors = await errorLogger.getSessionErrors();

    let summary = `Error Summary (Last Hour):\n`;
    summary += `• Total: ${stats.recentCount} errors\n`;
    summary += `• Critical/High: ${(stats.bySeverity.critical || 0) + (stats.bySeverity.high || 0)}\n`;
    summary += `• Session Errors: ${sessionErrors.length}\n`;

    if (stats.topErrors.length > 0) {
      summary += `• Most Frequent: "${stats.topErrors[0].message}" (${stats.topErrors[0].count}x)\n`;
    }

    return summary;
  }
}

export const bugReportGenerator = BugReportGenerator;