'use strict';

/* global beforeEach, describe, it */
/* eslint-disable no-unused-expressions */


const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai')
const Paykoun = require('../../lib/paykoun')
const PaykounContext = require('../../lib/context')
const MockMgr = require('./mock/ikue')
const Helpers = require('./helpers')

const expect = chai.expect;
const assert = chai.assert;
chai.use(sinonChai);


const { pushJobsInContext } = Helpers;

describe('helpers support', () => {
  let isTestContext = null;

  ['test', 'real'].forEach((contextType) => {
    describe(`(${contextType})`, () => {
      let context = null;
      let sayHelloWorker = null;
      let failingWorkerFunc = null;
      let sayHelloSpy = null;
      let funcSpy = null;

      beforeEach(() => {
        isTestContext = contextType === 'test'
        const queueMgr = new MockMgr()
        if (contextType === 'real') {
          context = new PaykounContext(queueMgr)
        } else {
          context = Paykoun.createTestContext();
        }
      })

      beforeEach((done) => {
        sayHelloSpy = sinon.spy();
        funcSpy = sinon.spy();

        sayHelloWorker = sinon.spy(function(job, onJobDone) {
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

        failingWorkerFunc = sinon.spy(function(job, onJobDone) {
          try {
            this.$getHelper('unexistingHelper');
          } catch (e) {
            return onJobDone(e, null);
          }

          return onJobDone(null, null);
        });

        context.registerWorker(Paykoun.createWorker('FailingWorker', {
          triggers: ['failingTrigger'],
          work: failingWorkerFunc,
        }));

        context.run(done);
      });

      it('should allow us to use a registered helper', (done) => {
        isTestContext && context.dontMock('sayHello');

        pushJobsInContext([
          {
            event: 'sayHello',
            data: { name: 'Hello world' },
          },
        ], context, isTestContext, (err) => {
          expect(sayHelloSpy).to.have.been.calledOnce

          const helperCall = sayHelloSpy.firstCall;
          expect(helperCall).to.not.have.thrown();
          expect(helperCall.args[0]).to.equal('Hello world');
          done();
        })
      });

      // Maybe in the long run we want to stub everything? or provide for a way that avoid
      // setting non function helpers?
      it('should only stub function helpers', (done) => {
        pushJobsInContext([
          {
            event: 'sayHello',
            data: { name: 'Hello world' },
          },
        ], context, isTestContext, () => {
          expect(sayHelloSpy).to.have.been.called;
          const helperCall = sayHelloSpy.firstCall;
          expect(helperCall).to.not.have.thrown();
          expect(helperCall.args[0]).to.equal('Hello world');
          done();
        })
      });

      it('should throw an error when trying to use an unregistered helper', (done) => {
        isTestContext && context.dontMock('unexistingHelper');
        pushJobsInContext([
          {
            event: 'failingTrigger',
            data: { name: 'Hello world' },
          },
        ], context, isTestContext, (err) => {
          // TODO: Make the handling of error the same for test and real context
          if (isTestContext) {
            const onDoneCall = failingWorkerFunc.firstCall.args[1];
            expect(onDoneCall.firstCall.args[0])
              .to.match(/Error: Trying to use an unregistered helper function/);
          } else {
            expect(err).to.match(/Trying to use an unregistered helper function/)
          }

          done();
        })
      });

      it('helpers are availaible from helpers');
      it('helpers are availaible using this.$helperName');
      it('worker cannot overwrite helper property');
      it('worker running context is not reused by different workers or consecutive runs');
    })
  })
})
