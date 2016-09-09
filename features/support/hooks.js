/* eslint new-cap: ["error", { "capIsNewExceptions": ["Before"] }] */

import fs from 'fs';
import tmp from 'tmp';

module.exports = function () {
  this.Before(() => {
    const tmpObject = tmp.dirSync({ unsafeCleanup: true });
    this.tmpDir = fs.realpathSync(tmpObject.name);
  });
}
