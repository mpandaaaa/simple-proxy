const app = require('./app.json');

/**
 * The app's config, with over the air updates left out of development.
 *
 * Everything real lives in app.json. This exists for one reason: the
 * development server asks the expo-updates command line tool to resolve a
 * runtime version on every manifest request, and on Windows that spawn
 * fails outright when the machine is short of memory, with
 *
 *   cli.js runtimeversion:resolve --platform ios
 *   exited with non-zero code: 3221225794
 *
 * which is STATUS_DLL_INIT_FAILED: Windows could not start the process at
 * all. The app then will not load, and nothing about the app is wrong.
 *
 * A development build talks to this server directly and never fetches an
 * update, so it does not need any of that. EAS builds do, and they set
 * EAS_BUILD, so they keep the whole configuration exactly as it is
 * written in app.json.
 */
module.exports = () => {
  const config = { ...app.expo };

  if (!process.env.EAS_BUILD) {
    delete config.updates;
    delete config.runtimeVersion;
  }

  return config;
};
