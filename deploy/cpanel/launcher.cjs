// Copy as app.js in apps/assets-aliyas/launcher, with package.json type commonjs.
// The stable launcher lets cPanel keep its standard startup file while releases
// and private runtime configuration stay outside the public document root.
process.env.ALIYAS_ENV_FILE ||=
  "/home/aliyasrealestate/assets-aliyas-private/runtime.env";
require("../current/app.cjs");
