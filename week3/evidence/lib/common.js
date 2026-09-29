// Shared reporting helpers for the A03 verification sections.

function a03Check(name, condition, detail) {
    return { name, passed: Boolean(condition), detail: detail === undefined ? '' : String(detail) };
}

function a03Summarise(checks) {
    const passed = checks.filter(check => check.passed).length;
    return { passed, failed: checks.length - passed, total: checks.length, checks };
}

function a03Percentile(sortedValues, fraction) {
    if (sortedValues.length === 0) {
        return 0;
    }
    const position = fraction * (sortedValues.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) {
        return sortedValues[lower];
    }
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

function a03Median(values) {
    return a03Percentile([...values].sort((a, b) => a - b), 0.5);
}

function a03Round(value, digits) {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
}
