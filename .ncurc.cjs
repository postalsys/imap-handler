'use strict';

module.exports = {
    // Node 20 is the supported runtime floor (see "engines" in package.json). A dependency major that
    // needs a newer Node has to be capped here with `target` or `reject`.
    upgrade: true,
    // @types/node stays on the 20.x line so the compiler rejects APIs that Node 20 does not have
    target: name => (name === '@types/node' ? 'minor' : 'latest')
};
