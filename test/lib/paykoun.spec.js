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

describe('Paykoun', () => {
  let queueMgr;

  beforeEach(() => {
    queueMgr = new MockMgr();
  });

  describe.only('PaykounContext', () => {
    it('Should create context correctly', () => {
      const context = Paykoun.createContext(queueMgr);
      expect(context.registerWorker).to.exist;
    });

    it('Running a context should create work queues', (done) => {
      const context = Paykoun.createContext(queueMgr);
      const fakeWorkFunc = () => {
      }

      context.registerWorker(Paykoun.createWorker('Worker1', {
        isolationPolicy: 'thread',
        concurrency: 1,
        triggers: ['event1'],
        work: fakeWorkFunc,
      }));

      context.registerWorker(Paykoun.createWorker('Worker2', {
        isolationPolicy: 'thread',
        concurrency: 1,
        triggers: ['event2'],
        work: fakeWorkFunc,
      }));

      context.run(() => {
      });

      queueMgr.on('ready', () => {
        expect(queueMgr.queues.length).to.eql(2);

        const queue1 = queueMgr.queues[0];

        expect(queue1.name).to.eql('Worker1');

        waitForQueues(queueMgr.queues, (err) => {
          expect(err).to.be.null;
          assert.ok(queueMgr.queues[0].eventBus);
          assert.ok(queueMgr.queues[1].eventBus);

          done(err);
        });
      });
    });
  });
});
