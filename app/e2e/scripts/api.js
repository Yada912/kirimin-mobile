// Helper for Maestro `runScript` steps. Runs on the laptop (not the phone), so it
// reaches the API on localhost. Set API_URL with `-e API_URL=...` to override.
//
//   ACTION=preflight    → fails early with a clear message if the backend/demo data isn't ready
//   ACTION=handoverCode → output.code = the 4-digit code of Wayan's latest active order
//                         (what the recipient would read out to the driver)

var base = typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:3000';

function login(phone) {
  var res = http.post(base + '/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone, password: 'kirimin123' }),
  });
  if (res.status !== 200) throw new Error('Login ' + phone + ' failed (' + res.status + '): ' + res.body);
  return json(res.body).token;
}

function get(path, token) {
  var res = http.get(base + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status !== 200) throw new Error('GET ' + path + ' failed (' + res.status + '): ' + res.body);
  return json(res.body);
}

if (ACTION === 'preflight') {
  var health = http.get(base + '/health');
  if (health.status !== 200) {
    throw new Error('Backend not reachable at ' + base + ' — start it with `cd server && npm run dev`.');
  }
  var trips = get('/trips/mine?scope=active', login('081200000003'));
  var usable = trips.filter(function (t) {
    return t.status === 'published' && t.slotsUsed < t.maxPackages && new Date(t.arriveAt).getTime() > Date.now();
  });
  if (usable.length === 0) {
    throw new Error('Made has no usable demo route (stale or full). Run `npm run db:reset` in server/, restart the server, then rerun.');
  }
  output.preflight = 'ok';
}

if (ACTION === 'handoverCode') {
  var orders = get('/orders?as=sender&scope=active', login('081200000001'));
  var withCode = orders.filter(function (o) { return o.handoverCode && o.driver; });
  if (withCode.length === 0) throw new Error('Wayan has no active order with a driver — did the send flow run?');
  output.code = withCode[0].handoverCode; // newest first
}
