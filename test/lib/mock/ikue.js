'use strict';

var EventEmitter= require('events').EventEmitter;
var util = require('util');
var sinon = require('sinon');
var _ = require('lodash');
var Job = require('ikue').Job;
var EventBusAsync = require('ikue').EventBus;

function MockMgr(){
  this.failConnecting = false;
  this.queues = [];

  this.eventBus = new EventBusAsync()
}

util.inherits(MockMgr, EventEmitter);

MockMgr.prototype.createQueue = function(queueName) {
  var self = this;

  var queue = new EventEmitter();

  queue = _.extend(queue, {
    name: queueName,
    start: function(){
      process.nextTick(function(){
        queue.emit('ready');
      });
    },
    stop: function(){
      process.nextTick(function(){
        queue.emit('stopped');
      });
    },
    eventBus: this.eventBus,
    createJob: function(type, data){
      var job = new Job(type, data);
      job.workQueue(this);

      return job;
    },

    pushJob: function(job, done){
      setTimeout(() => {
        this.eventBus.trigger(job.type, job.data, done);
      }, 1);
    }
  });

  this.queues.push(queue);

  return queue;
};


MockMgr.prototype.shouldFailConnecting = function(fail) {
  this.failConnecting = true;

  if (typeof(fail) != 'undefined') {
    this.failConnecting = fail;
  }
};

MockMgr.prototype.connect = function() {
  setTimeout(function(){
    if (this.failConnecting) {
      this.emit('error', new Error("Unable to connect"));
    } else {
      this.emit('ready');
    }
  }.bind(this), 1);
};

module.exports = MockMgr;
