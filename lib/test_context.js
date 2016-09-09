'use strict';

/* global setTimeout */

var assert = require('assert');
var _ = require('lodash');
var events = require('events');
var util = require('util');
var sinon = require('sinon');

var RegularContext = require('./context');

var Job = require('ikue').Job;

function TestJob(context, name, data){
  Job.call(this, name, data);
  this.context = context;
}

util.inherits(TestJob, Job);

class JobQueue {
  constructor(context) {
    this.jobs = {};
    this.context = context;
    this.flushing = false;
  }

  pushJob(event, params) {
    if (this.flushing) {
      throw new Error('You cannot push a job when the JobQueue is being flushed');
    }

    const job = new TestJob(this.context, event, params)
    assert.ok(job.id, 'A job should have an id');

    this.jobs[job.id] = job;

    return job;
  }
}

TestJob.prototype.send = function(done){
  const queue = this.context.queue();
  if (queue.flushing) {
    throw new Error('You cannot push a job when the JobQueue is being flushed');
  }
  assert.ok(this.id, 'A job should have an id');
  queue.jobs[this.id] = this;

  process.nextTick(() => done());
};

class PaykounTestContext extends RegularContext {
  constructor() {
    super()
    this.eventbus = new events.EventEmitter();

    // Contains list of services not to mock
    this.dontMockHelpers = {};

    this.defaultQueue = new JobQueue(this)
  }

  registerWorker(workerFact) {
    super.registerWorker(workerFact)
  }

  createJob(event, params) {
    const job = new TestJob(this, event, params)
    assert.ok(job.id, 'A job should have an id');
    return job;
  }

  dontMock(name) {
    this.dontMockHelpers[name] = true;
  }

  destroy() {
    super.destroy()
    this.eventbus.removeAllListeners();
    this.allWorkersSpecs = null;
    this.eventbus = null;
  }

  queue() {
    return this.defaultQueue;
  }

  dispatchJob(job, done) {
    var self = this;
    process.nextTick(function(){
      if (_.isFunction(done)) {
        done(null, null);
      }

      _.extend(job.data, {id: job.id});

      process.nextTick(function(){
        self.eventbus.emit(job.type, job.data);
      });
    });
  }

  run(done) {
    var self = this;

    _.each(self.allWorkers, function(worker){
      var triggers = worker.triggers();

      _.each(triggers, function(trigger){
        self.eventbus.on(trigger, function(job){
          var boundFunc = _.bind(self.runJobInContext, self, worker);

          boundFunc(job);
        });
      });

    })

    process.nextTick(() => {
      return done(null, null);
    });
  }
}

_.extend(PaykounTestContext.prototype, events.EventEmitter.prototype);

PaykounTestContext.prototype.initHelpersContext = function(){
  var self = this;

  if (this.helpers) {
    return;
  }

  RegularContext.prototype.initHelpersContext.call(this);

  // We want to stub all helpers unless specificaly requested on this context
  // This make for a better unit testing and for a better test quality overall
  var $getHelper = _.wrap(this.helpers.$getHelper, function(wrappedFunc, name){
    var helper = self.dontMockHelpers[name];

    if (helper || !_.isFunction(helper)) {
      return wrappedFunc(name);
    }

    return sinon.stub();
  });

  self.helpers.$getHelper = $getHelper;
};

PaykounTestContext.prototype.runJobInContext = function(worker, job) {
  var self = this;

  var onDone = function onDone(err, result){
    self.emit('job_done', job, err, result);
  };

  var object = {
    done: onDone
  };

  var onDoneStub = sinon.stub(object, 'done', object.done);

  var runCtx = worker.runContext();

  _.bind(worker.workFunc, runCtx)(job, onDoneStub);
};

JobQueue.prototype.flush = function(done) {
  var self = this;

  this.flushing = true;

  _.each(this.jobs, (job) => {
    this.context.dispatchJob(job);
  });

  // Invoked when the event 'job_done' is emitted byt the context
  /* eslint-disable no-unused-vars */
  function onJobDone(job, err, result) {
    delete self.jobs[job.id];
  }
  /* eslint-enable no-unused-vars*/

  this.context.on('job_done', onJobDone);

  // invoked when either there is a timeout or the flushing succeed
  /* eslint-disable no-unused-vars*/
  function onFlushingDone(err, res) {
    self.context.removeListener('job_done', onJobDone);
    done(err, res);
  }
  /* eslint-enable no-unused-vars */

  var counter = 20;

  var INTERVAL = 2;

  function checkQueue() {
    counter--;
    if (self.jobs > 0 && counter > 0) {
      setTimeout(checkQueue, INTERVAL);

      return;
    } else if(counter === 0) {
      onFlushingDone(new Error('Flushing the queue timed out'));

      return;
    }

    onFlushingDone();
    return;
  }

  setTimeout(checkQueue, INTERVAL);
};

module.exports = PaykounTestContext;
module.exports.TestJob = TestJob;
