const jr = require('jasmine-spec-reporter');

let env = jasmine.getEnv();
env.clearReporters();
env.addReporter(new jr.SpecReporter({
  spec: {
    displayPending: true
  }
}) as any);
