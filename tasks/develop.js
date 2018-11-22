
/*
 * @module grunt-multi-develop
 * @author Antonio Giordano <antonio.giordano@ubiatar.com>
 * @description http://github.com/ubiatar/grunt-multi-develop/
 * @license MIT
 */
'use strict';

module.exports = function(grunt) {
  var children = {}
    , running = false
    , fs = require('fs')
    , util = require('util');
  // kills child process (server)
  grunt.event.on('develop.kill', function(target) {
    grunt.log.warn('kill process');
    children[target].kill('SIGKILL');
  });
  // spawned, notify grunt to move onto next task
  grunt.event.on('develop.started', function() {
    setTimeout(function() {
      global.gruntDevelopDone();
    }, 250);
  });
  // starts server
  grunt.event.on('develop.start', function(filename, nodeArgs, args, env, cmd, target) {
    var spawnArgs = nodeArgs.concat([filename], args);
    if (children[target]) {
      return grunt.event.emit('develop.kill', target);
    }
    children[target] = grunt.util.spawn({
      cmd: cmd,
      args: spawnArgs,
      opts: {
        env: env
      }
    }, function(){});
    // handle exit
    children[target].on('exit', function(code, signal) {
      delete children[target];
      if (signal !== null) {
        grunt.log.warn(util.format('application exited with signal %s', signal));
      } else {
        grunt.log.warn(util.format('application exited with code %s', code));
      }
      if (signal === 'SIGKILL') {
        grunt.event.emit('develop.start', filename, nodeArgs, args, env, cmd);
      }
    });
    children[target].stderr.on('data', function(buffer) {
      if (buffer.toString().trim().length) {
        grunt.log.write('\r\n[grunt-develop:' + target + '] > '.red + buffer.toString());
      }
    });
    children[target].stdout.on('data', function (buffer) {
      grunt.log.write('\r\n[grunt-develop:' + target + '] > '.cyan + buffer.toString());
    });
    grunt.log.write('\r\n[grunt-develop:' + target + '] > '.cyan + util.format('started application "%s".', filename));
    grunt.event.emit('develop.started');
  });
  // TASK. perform setup
  grunt.registerMultiTask('develop', 'init', function() {
    var filename = this.data.file
      , nodeArgs = this.data.nodeArgs || []
      , args = this.data.args || []
      , env = this.data.env || process.env || {}
      , cmd = this.data.cmd || process.argv[0];
    if (!grunt.file.exists(filename)) {
      grunt.fail.warn(util.format('application file "%s" not found!', filename));
      return false;
    }
    global.gruntDevelopDone = this.async();
    grunt.event.emit('develop.start', filename, nodeArgs, args, env, cmd, this.target);
  });
  process.on('exit', function() {
    for (let c in children) {
      try {
        children[c].kill('SIGINT');
      } catch (e) {
        grunt.fail.warn(util.format('Process exit killing target "%s": "%s"!', c, err.message));
      }
    }
  });
};

/* EOF */
