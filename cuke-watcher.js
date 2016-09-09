#!/usr/bin/env node

/* eslint-disable */
var watch = require('node-watch');
var child_process = require('child_process');
var running = false;
var cucumber;

var JS_EXT = /(^.*\.js)|(^.*\.feature)/i;
var options = ['node_modules/.bin/cucumber-js',
               'features',
               '--compiler', 'js:babel-core/register',
               '-f', 'pretty'];

watch(['./features/', 'test'], {recursive:true}, function(filename) {

  if(!running && filename.match(JS_EXT)) {

    running = true;

    cucumber = child_process.spawn('node', options)
                    .on('exit', function() {
                      running = false;
                    });

    cucumber.stdout.on('data', function(d) {
      console.log(String(d));
    });

    cucumber.stderr.on('data', function(d) {
      console.error(String(d));
    });

  }

});

/* eslint-enable */
