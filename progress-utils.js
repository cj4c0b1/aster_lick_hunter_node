const ora = require('ora').default;
const cliProgress = require('cli-progress');

class ProgressTracker {
  constructor() {
    this.spinner = ora({ spinner: 'dots' });
    this.multiBar = new cliProgress.MultiBar({
      format: '{bar} {percentage}% | {value}/{total} | {name}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: true,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);
    this.bars = new Map();
    this.startTime = Date.now();
  }

  startSpinner(text) {
    this.spinner.text = text;
    this.spinner.start();
    return this.spinner;
  }

  updateSpinner(text) {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  createProgressBar(total, name) {
    const bar = this.multiBar.create(total, 0, { name });
    this.bars.set(name, bar);
    return bar;
  }

  updateProgressBar(name, value, payload = {}) {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(value, payload);
    }
  }

  incrementBar(name, payload = {}) {
    const bar = this.bars.get(name);
    if (bar) {
      bar.increment(1, payload);
    }
  }

  getElapsedTime() {
    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  stop() {
    if (this.spinner) {
      this.spinner.stop();
    }
    if (this.multiBar) {
      this.multiBar.stop();
    }
    this.bars.clear();
  }

  log(message) {
    if (this.spinner) {
      this.spinner.stopAndPersist({
        symbol: 'ℹ️',
        text: message
      });
      this.spinner.start();
    } else {
      console.log(`ℹ️ ${message}`);
    }
  }

  success(message) {
    if (this.spinner) {
      this.spinner.succeed(message);
    } else {
      console.log(`✅ ${message}`);
    }
  }

  error(message) {
    if (this.spinner) {
      this.spinner.fail(message);
    } else {
      console.error(`❌ ${message}`);
    }
  }
}

module.exports = { ProgressTracker };
