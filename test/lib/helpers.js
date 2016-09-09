'use strict';
const vasync = require('vasync')

class Helpers {
  static pushJobsInContext(jobs, context, isTest, done) {
    vasync.forEachParallel({
      func: (jobParams, callback) => {
        const job = context.createJob(jobParams.event, jobParams.data)

        return job.send(callback)
      },
      inputs: jobs,
    }, (err, res) => {
      if (!err && isTest) {
        return context.queue().flush(done)
      }
      return done(err, res);
    })
  }
}

module.exports = Helpers
