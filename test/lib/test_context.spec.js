/* eslint-disable no-unused-expressions */
/* global it, describe, beforeEach */

const paykounPath = '../../lib/paykoun';

const chai = require('chai')
const sinonChai = require('sinon-chai')
const sinon = require('sinon')

const expect = chai.expect;
const should = chai.should;
const assert = chai.assert;
const match = sinon.match;
chai.use(sinonChai);
chai.use(should);

const Paykoun = require(paykounPath);

describe('Paykoun Test Context', () => {
  let context = null;
  let queue = null;
  let workerOneSpy = null;
  let workerOneSpy2 = null;

  beforeEach((done) => {
    context = Paykoun.createTestContext();
    queue = context.queue();

    workerOneSpy = sinon.stub();
    workerOneSpy2 = sinon.stub();

    context.registerWorker(Paykoun.createWorker('Worker1', {
      triggers: ['event1'],
      work: workerOneSpy,
      timeout: 10000,
    }));

    context.registerWorker(Paykoun.createWorker('Worker2', {
      triggers: ['event2'],
      work: workerOneSpy2,
      timeout: 10000,
    }));

    context.run(done);
  });

  describe('getHelpers', () => {
    it('returns list of helpers', () => {
      context.useHelper('helperName', () => {})
      const res = context.getHelpers()
      expect(res).to.be.a('object')
      expect(res).to.have.property('$getHelper')
      expect(res.$getHelper('helperName')).to.be.a('function')
    })
  })

  it('should allow us to assert on the outcome of the job execution', (done) => {
    workerOneSpy.callsArgWith(1, 'hello', 'world');

    queue.pushJob('event1', { name: 'Diallo' });
    queue.flush(() => {
      const call = workerOneSpy.firstCall;
      const onDoneSpy = call.args[1];

      expect(typeof onDoneSpy).to.match(/function/);
      assert(onDoneSpy.called);
      expect(onDoneSpy).to.have.been.calledWith('hello', 'world');

      done();
    });
  });

  it('should dispatch jobs', (done) => {
    queue.pushJob('event1', { name: 'Diallo' });
    queue.pushJob('event1', { name: 'Paul' });

    queue.flush(() => {
      assert(workerOneSpy.called);

      const firstCall = workerOneSpy.getCall(0);
      const secondCall = workerOneSpy.getCall(1);

      expect(firstCall.args[0]).to.have.property('name', 'Diallo');
      expect(secondCall.args[0]).to.have.property('name', 'Paul');

      done();
    });
  });
});
