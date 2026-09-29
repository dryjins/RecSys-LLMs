// Section B -- unit and regression suite, run from the real tests.js.

function a03Section() {
    const outcome = runA03UnitTests();
    return {
        section: 'B-unit-and-regression',
        summary: { passed: outcome.passed, failed: outcome.failed, total: outcome.total },
        checks: outcome.results
    };
}
