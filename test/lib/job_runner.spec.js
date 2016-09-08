/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable no-underscore-dangle */
/* global it, describe, beforeEach, afterEach */


const paykounPath = '../../lib/'


const rewire = require('rewire') // rewiring library

const chai = require('chai')
const sinon = require('sinon')
const util = require('util')
const _ = require('lodash')
const sinonChai = require('sinon-chai')
const EventEmitter = require('events').EventEmitter
const MockMgr = require('./mock/ikue')

const assert = chai.assert
chai.use(sinonChai)

// const Paykoun = rewire(`${paykounPath}/paykoun`)
const JobRunner = rewire(`${paykounPath}/job_runner`)

describe('JobRunner', () => {
  let queueMgr = null

  beforeEach(() => {
    queueMgr = new MockMgr()
  })

  describe('Basics', () => {
    it('Creating a JobRunner validate the properties', () => {
      assert.throws(JobRunner.create, /type/)

      assert.throws(_.bind(JobRunner.create,
        this,
        { type: 'vasync' }),
        /concurrency/)

      assert.throws(_.bind(JobRunner.create,
        this,
        { type: 'vasync', concurrency: 12 }),
        /name/)

      assert.throws(_.bind(JobRunner.create,
        this,
        { type: 'vasync', concurrency: 12, name: 'Name' }),
        /callback/)
    })

    it('Creating a JobRunner with invalid "type" fail', () => {
      const done = sinon.spy()

      assert.throws(_.bind(JobRunner.create,
        this,
         { type: 'unexisting', concurrency: 1, name: 'Name' }, done))

      assert.doesNotThrow(_.bind(JobRunner.create,
        this,
        { type: 'vasync', concurrency: 1, name: 'Name' }, done))

      assert.doesNotThrow(_.bind(JobRunner.create,
        this,
        { type: 'vasync', concurrency: 1, name: 'Name' }, done))
    })
  })
})
