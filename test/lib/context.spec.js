/* eslint-disable no-unused-expressions */
/* eslint-disable no-underscore-dangle */
/* global it, describe, beforeEach, afterEach */

// const paykounPath = '../../lib/paykoun'


const rewire = require('rewire')

const PaykounContext = rewire('../../lib/context')
const Paykoun = rewire('../../lib/paykoun')

const chai = require('chai')
// const vasync = require('vasync')
const _ = require('lodash')
const sinonChai = require('sinon-chai')
const sinon = require('sinon')
const vasync = require('vasync')
const MockMgr = require('./mock/ikue')

const expect = chai.expect
const match = sinon.match
// const assert = chai.assert

chai.use(sinonChai);

const pushJobsInContext = (jobs, context, isTest, done) => {
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

describe('PaykounContext', () => {
  ['test', 'real'].forEach((contextType) => {
    describe(`(${contextType})`, () => {
      let context
      const originalLogger = PaykounContext.__get__('logger')

      beforeEach(() => {
        const queueMgr = new MockMgr()
        if (contextType === 'real') {
          context = new PaykounContext(queueMgr)
        } else {
          context = Paykoun.createTestContext();
        }
      })

      afterEach(() => {
        PaykounContext.__set__('logger', originalLogger)
      })

      if (contextType === 'real') {
        describe('useStatsD', () => {
          it('instantiate a statsdClient with default params', () => {
            context.useStatsD()
            expect(context.statsdClient).to.not.be.null
            expect(context.statsdClient.host).to.eql('localhost')
            expect(context.statsdClient.port).to.eql(8125)
          })

          it('instantiate a statsdClient with default port', () => {
            context.useStatsD({
              host: 'statsd.host.localhost',
            })

            expect(context.statsdClient).to.not.be.null
            expect(context.statsdClient.host).to.eql('statsd.host.localhost')
            expect(context.statsdClient.port).to.eql(8125)
          })
        })

        describe('useLogger', () => {
          it('use default logger when none is passed', () => {
            const currentLogger = PaykounContext.__get__('logger')
            expect(currentLogger.constructor.name).to.eql('ConsoleLogger')
          })

          it('use the passed logger', () => {
            const myLogger = {}
            context.useLogger(myLogger)
            expect(PaykounContext.__get__('logger')).to.eql(myLogger)
          })
        })
      }

      describe('useHelper', () => {
        it('validate helper name', () => {
          expect(() => {
            context.useHelper(null, () => {})
          }).to.throw('provide a name for this helper')

          expect(() => {
            context.useHelper({}, () => {})
          }).to.throw('name should be a string')
        })

        it('validate helper object is a function or an object', () => {
          expect(() => {
            context.useHelper('helper1', null)
          }).to.throw('need to provide a helper')

          expect(() => {
            context.useHelper('helper1', 'SOME_HELPER')
          }).to.throw('helper need to be a function or object')

          expect(() => {
            context.useHelper('helper2', () => {})
          }).to.not.throw('You can only register a helper once')
        })

        it('validate that the same helper name is not used twice', () => {
          expect(() => {
            context.useHelper('helper', () => {})
            context.useHelper('helper', () => {})
          }).to.throw('You can only register a helper once')
        })
      })

      describe('$getHelper', () => {
        it('$getHelper function exists', () => {
          expect(context.helpers.$getHelper).to.be.a('function')
        })

        it('$getHelper function returns previously saved helper', () => {
          const helper = () => 'helper result'
          context.useHelper('helper', helper)
          const helperFunc = context.helpers.$getHelper('helper')
          expect(helperFunc()).to.eql('helper result')
        })
      })

      describe('initHelpersContext', () => {
        it('initialize helpers', () => {
          expect(context.helpers).to.not.exists
          context.initHelpersContext()
          expect(context.helpers).to.exists

          expect(context.helpers.$getHelper).to.be.a('function')

          expect(() => {
            context.helpers.$getHelper('unexisting')
          }).to.throw('Trying to use an unregistered helper function')
        })
      })

      describe('getHelpers', () => {
        it('returns list of helpers', () => {
          context.useHelper('helperName', () => {})
          const res = context.getHelpers()
          expect(res).to.be.a('object')
          expect(res).to.have.property('$getHelper')
        })
      })

      describe('registerWorker', () => {
        let workerDef = null;
        let worker = null;

        beforeEach(() => {
          worker = {}

          workerDef = {
            instantiate: sinon.stub().returns(worker),
            name: 'WorkerName',
            extend: sinon.spy(),
          }
        })

        it('validate input (worker name required)', () => {
          expect(() => {
            context.registerWorker(_.assign(workerDef, { name: null }));
          }).to.throw('Can\'t register a worker without a name')
        })

        it('validate input (worker definition have an instantiate function)', () => {
          expect(() => {
            context.registerWorker(_.assign(workerDef, { instantiate: undefined }));
          }).to.throw('instantiate should be a function')
        })

        it('register worker after instantiating it from its definition', () => {
          context.registerWorker(workerDef)
          expect(workerDef.instantiate).to.have.been.calledOnce
          expect(workerDef.extend).to.have.been.calledOnce
          expect(workerDef.extend).to.have.been.calledWith(match({
            $getHelper: match.func,
          }))

          expect(context.allWorkers).to.have.property('WorkerName', worker)
        })
      })

      if (contextType !== 'test') {
        describe('context.run()', () => {
          let fakeWorkFunc = null;
          beforeEach(() => {
            fakeWorkFunc = sinon.spy(() => {
            })

            context.registerWorker(Paykoun.createWorker('Worker1', {
              work: fakeWorkFunc,
            }));

            context.registerWorker(Paykoun.createWorker('Worker2', {
              work: fakeWorkFunc,
            }));
          })

          beforeEach(() => {
            sinon.spy(context.workQueueManager, 'createQueue')
            sinon.spy(context, 'connectWorkQueues')
            sinon.spy(context, 'createJobRunners')
            sinon.spy(context, 'startCubicles')
            _.each(context.allWorkers, worker => {
              sinon.spy(worker, 'setWorkQueue')
            })
          })

          it('create work queues and job runners', (done) => {
            context.run((err) => {
              expect(err).to.be.null
              expect(context.workQueueManager.createQueue).to.have.been.callCount(3);

              _.each(context.allWorkers, worker => {
                expect(worker.setWorkQueue).to.have.been.calledOnce;
              })

              const connectQueuesArgs = context.connectWorkQueues.getCall(0).args
              expect(context.startCubicles).to.have.been.calledOnce
              expect(connectQueuesArgs[0].queues).to.have.length(2)
              expect(connectQueuesArgs[1]).to.be.a('function')

              expect(context.createJobRunners).to.have.been.calledOnce
              const createJobRunnersArgs = context.createJobRunners.getCall(0).args
              expect(createJobRunnersArgs[0].jobRunners).to.have.length(1)
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[0].name', 'DefaultIsolationGroup:vasync')
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[0].concurrency', 20)
              expect(Object.keys(context.jobRunners)).to.have.length(1)

              expect(context.startCubicles).to.have.been.calledOnce
              done(err);
            });
          })

          it('fails if connectWorkQueue fail', (done) => {
            _.each(context.workQueues, queue => sinon.spy(queue, 'stop'))

            sinon
              .stub(context, 'connectWorkQueue')
              .yieldsAsync(null)
              .onCall(0)
              .yieldsAsync(new Error('connect error'));

            context.run((err) => {
              expect(err).to.match(/connect error/)
              _.each(context.workQueues, queue => {
                expect(queue.stop).to.not.have.been.calledOnce
              })

              done()
            });
          })

          it('fails if associated workQueueManager fails', (done) => {
            context.workQueueManager.shouldFailConnecting(true)
            context.run((err) => {
              expect(err).to.not.be.null;
              done();
            });
          })

          it('create single job runner for same isolation Group', (done) => {
            context.registerWorker(Paykoun.createWorker('Worker3', {
              isolationGroup: 'Worker3',
              work: fakeWorkFunc,
            }));

            context.run((err) => {
              expect(context.workQueueManager.createQueue).to.have.been.callCount(4);

              expect(context.createJobRunners).to.have.been.calledOnce
              const createJobRunnersArgs = context.createJobRunners.getCall(0).args
              expect(createJobRunnersArgs[0].jobRunners).to.have.length(2)
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[0].name', 'DefaultIsolationGroup:vasync')
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[1].name', 'Worker3:vasync')
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[0].concurrency', 20)
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[1].concurrency', 20)
              expect(Object.keys(context.jobRunners)).to.have.length(2)
              done(err);
            });
          })

          it('use highest concurrency value for same isolation Group', (done) => {
            context.registerWorker(Paykoun.createWorker('Worker3', {
              isolationGroup: 'Worker3',
              concurrency: 11111,
              work: fakeWorkFunc,
            }));

            context.run((err) => {
              expect(context.workQueueManager.createQueue).to.have.been.callCount(4);

              expect(context.createJobRunners).to.have.been.calledOnce
              const createJobRunnersArgs = context.createJobRunners.getCall(0).args
              expect(createJobRunnersArgs[0].jobRunners).to.have.length(2)
                .deep.property('[1].name', 'Worker3:vasync')
              expect(createJobRunnersArgs[0].jobRunners).to.have
                .deep.property('[1].concurrency', 11111)
              done(err);
            });
          })
        })
      }

      describe('job dispatch', () => {
        let workerOneSpy = null;
        let workerOneSpy2 = null;
        let isTestContext = null;

        beforeEach((done) => {
          isTestContext = contextType === 'test'
          workerOneSpy = sinon.stub().yieldsAsync(null, null);
          workerOneSpy2 = sinon.stub().yieldsAsync(null, null);

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

        it('should dispatch job to the correct worker only', (done) => {
          pushJobsInContext([
            {
              event: 'event2',
              data: { name: 'Diallo' },
            },
          ], context, isTestContext, (err) => {
            expect(err).to.not.exist
            expect(workerOneSpy2.callCount).to.eql(1)
            expect(workerOneSpy2).to.have.been.calledOnce
            expect(workerOneSpy2).to.have.been.calledWithMatch(match({
              name: 'Diallo',
              id: match.string,
            }))

            expect(workerOneSpy2).to.have.been.called;

            done();
          })
        })

        it('should dispatch multiple jobs to same worker', (done) => {
          pushJobsInContext([
            {
              event: 'event1',
              data: { name: 'Diallo' },
            },
            {
              event: 'event1',
              data: { name: 'Paul' },
            },
          ], context, isTestContext, (err) => {
            expect(err).to.not.exist

            expect(workerOneSpy).to.have.been.called
            const firstCall = workerOneSpy.getCall(0);
            const secondCall = workerOneSpy.getCall(1);

            expect(firstCall.args[0]).to.have.property('name', 'Diallo');
            expect(secondCall.args[0]).to.have.property('name', 'Paul');

            done();
          })
        })

        it('should dispatch job to different worker', (done) => {
          pushJobsInContext([
            {
              event: 'event1',
              data: { name: 'Diallo' },
            },
            {
              event: 'event2',
              data: { name: 'Paul' },
            },
          ], context, isTestContext, (err) => {
            expect(err).to.not.exist

            expect(workerOneSpy).to.have.been.called
            expect(workerOneSpy2).to.have.been.called
            const firstCall = workerOneSpy.getCall(0);
            const secondCall = workerOneSpy2.getCall(0);

            expect(firstCall.args[0]).to.have.property('name', 'Diallo');
            expect(secondCall.args[0]).to.have.property('name', 'Paul');

            done();
          })
        })

        if (isTestContext) {
          it('should create jobs and push them correctly', (done) => {
            const queue = context.queue();
            const job = queue.pushJob('event1', { name: 'Diallo' });
            queue.flush(() => {
              const call = workerOneSpy.getCall(0);

              expect(call.args[0]).to.have.property('id', job.id);
              expect(typeof call.args[1]).to.match(/function/);
              done();
            });
          });

          it('should allow us to assert on the outcome of the job execution', (done) => {
            workerOneSpy.callsArgWith(1, 'hello', 'world');

            const queue = context.queue();
            queue.pushJob('event1', { name: 'Diallo' });
            queue.flush(() => {
              const call = workerOneSpy.firstCall
              const onDoneSpy = call.args[1]

              expect(typeof onDoneSpy).to.match(/function/)
              expect(onDoneSpy).to.have.been.called
              expect(onDoneSpy).to.have.been.calledWith('hello', 'world');

              done();
            });
          });
        }
      })
    })
  })
})
