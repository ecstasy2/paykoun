'use strict';

/* eslint-disable no-unused-expressions */
/* global it, describe, beforeEach */

const paykounPath = '../../lib/paykoun';


const rewire = require('rewire'); // rewiring library

// const PaykounContext = rewire('../../lib/context');

const chai = require('chai');
const vasync = require('vasync');
const _ = require('lodash');
const sinonChai = require('sinon-chai');
const MockMgr = require('./mock/ikue');

const expect = chai.expect;
const assert = chai.assert;

chai.use(sinonChai);

const Paykoun = rewire(paykounPath);

function waitForQueues(arg, done) {
  let queues = arg;

  if (!_.isArray(arg)) {
    queues = [arg];
  }

  vasync.forEachParallel({
    func: (queue, callback) => {
      queue.on('ready', () => {
        callback();
      });
    },
    inputs: queues,
  }, (err, res) => {
    done(err, res);
  });
}

describe('Paykoun module', () => {
  // let queueMgr;

  // beforeEach(() => {
  //   queueMgr = new MockMgr();
  // });
});
