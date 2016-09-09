/* global beforeEach, describe, it */
/* eslint-disable no-unused-expressions */

const paykounPath = '../../lib/paykoun';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const expect = chai.expect;
const assert = chai.assert;
chai.use(sinonChai);

const Paykoun = require(paykounPath);


describe('Paykoun Test Context', () => {
  let context = null;
  let queue = null;
  let sayHelloWorker = null;
  let failingWorkerFunc = null;
  let sayHelloSpy = null;
  let funcSpy = null;

  beforeEach((done) => {
    context = Paykoun.createTestContext();
    queue = context.queue();

    sayHelloSpy = sinon.spy();
    funcSpy = sinon.spy();

    sayHelloWorker = sinon.spy((job, onJobDone) => {
      const $sayHello = this.$getHelper('sayHello');
      const $objectHelper = this.$getHelper('objectHelper');

      $objectHelper.func();
      $sayHello(job.name);

      onJobDone(null, null);
    });

    context.useHelper('sayHello', sayHelloSpy);
    context.useHelper('objectHelper', {
      func: funcSpy,
    });

    context.registerWorker(Paykoun.createWorker('SayHelloWorker', {
      triggers: ['sayHello'],
      work: sayHelloWorker,
    }));

    failingWorkerFunc = sinon.spy((job, onJobDone) => {
      try {
        this.$getHelper('unexistingHelper');
      } catch (e) {
        onJobDone(e, null);
      }

      onJobDone(null, null);
    });

    context.registerWorker(Paykoun.createWorker('FailingWorker', {
      triggers: ['failingTrigger'],
      work: failingWorkerFunc,
    }));

    context.run(done);
  });

  it('should allow us to use a registered helper', (done) => {
    context.dontMock('sayHello');

    queue.pushJob('sayHello', { name: 'Hello world' });

    queue.flush(() => {
      expect(sayHelloSpy).to.have.been.called

      const helperCall = sayHelloSpy.firstCall;
      expect(helperCall).to.not.have.thrown();
      expect(helperCall.args[0]).to.equal('Hello world');
      done();
    });
  });

  // Maybe in the long run we want to stub everything? or provide for a way that avoid
  // setting non function helpers?
  it('should only stub function helpers', (done) => {
    queue.pushJob('sayHello', { name: 'Hello world' });

    queue.flush(() => {
      expect(sayHelloSpy).to.have.been.called;
      const helperCall = sayHelloSpy.firstCall;
      expect(helperCall).to.not.have.thrown();
      expect(helperCall.args[0]).to.equal('Hello world');
      done();
    });
  });

  it('should throw an error when trying to use an unregistered helper', (done) => {
    context.dontMock('unexistingHelper');

    queue.pushJob('failingTrigger', { name: 'Hello world' });

    queue.flush(() => {
      assert(failingWorkerFunc.called);

      const onDoneCall = failingWorkerFunc.firstCall.args[1];

      assert(onDoneCall.calledOnce);
      expect(onDoneCall.firstCall.args[0])
        .to.match(/Error: Trying to use an unregistered helper function/);
      done();
    });
  });
});
