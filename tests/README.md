# Dataset acceptance checks

Start the app and run `node --import tsx --test tests/security.test.ts` to check the unauthenticated page and API boundary. The data and export acceptance checks are run by `npm run verify:dataset` against the configured database and bucket once the seed workbook has been supplied.
