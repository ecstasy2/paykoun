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
const MockMgr = require('./mock/ikue')

const expect = chai.expect
const match = sinon.match
// const assert = chai.assert

chai.use(sinonChai);

describe('PaykounContext', () => {
  let context
  const originalLogger = PaykounContext.__get__('logger')

  beforeEach(() => {
    const queueMgr = new MockMgr()
    context = new PaykounContext(queueMgr)
  })

  afterEach(() => {
    PaykounContext.__set__('logger', originalLogger)
  })

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
        expect(context.workQueueManager.createQueue).to.have.been.calledTwice;

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
        expect(context.workQueueManager.createQueue).to.have.been.calledThrice;

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
        concurrency: 1111,
        work: fakeWorkFunc,
      }));

      context.run((err) => {
        expect(context.workQueueManager.createQueue).to.have.been.calledThrice;

        expect(context.createJobRunners).to.have.been.calledOnce
        const createJobRunnersArgs = context.createJobRunners.getCall(0).args
        expect(createJobRunnersArgs[0].jobRunners).to.have.length(2)
          .deep.property('[1].name', 'Worker3:vasync')
        expect(createJobRunnersArgs[0].jobRunners).to.have
          .deep.property('[1].concurrency', 1111)
        done(err);
      });
    })
  })
})
