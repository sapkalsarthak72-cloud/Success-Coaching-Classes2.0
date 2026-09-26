// Serves the portal UI locally and bridges google.script.run -> the mocked Apps Script backend.
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const { loadPortal } = require('./mock-gas');
const FE = path.join(__dirname, '..', 'src', 'frontend');
const ctx = loadPortal(path.join(__dirname, '..', 'src', 'backend'));
const run = c => vm.runInContext(c, ctx);
const origLog = console.log; console.log = () => {};
run('setupPortal()');
run('Db.update("Users", Db.first("Users", u => u.Role==="ADMIN"), {AuthData: Auth.make("Admin@12345")})');
if (process.argv[2] !== 'empty') run('loadTestData()');
console.log = origLog;

function page() {
  let html = fs.readFileSync(process.env.INDEX || path.join(FE, 'Index.html'), 'utf8');
  html = html.replace(/<\?!= include\('([A-Za-z_]+)'\) \?>/g, (m, n) => fs.readFileSync(path.join(FE, n + '.html'), 'utf8'));
  html = html.replace('<?= appTitle ?>', 'Success Coaching Classes');
  const shim = `<script>
  window.google={script:{run:new Proxy({},{get:(t,name)=>{ if(name!=='api') return ()=>{};
    let ok,fail; const o={withSuccessHandler(f){ok=f;return o;},withFailureHandler(f){fail=f;return o;},
      api(a,t,p){ fetch('/rpc',{method:'POST',body:JSON.stringify({a,t,p})}).then(r=>r.json()).then(ok,fail); }}; return (...args)=>o.api(...args) && 0 || o.api.apply(null,args); }})}};
  </script>`;
  // simpler, explicit shim (the Proxy above is replaced by this):
  const shim2 = `<script>
  (function(){ function mk(){ var ok=function(){},fail=function(){}; var o={ withSuccessHandler:function(f){ok=f;return o;}, withFailureHandler:function(f){fail=f;return o;},
    api:function(a,t,p){ fetch('/rpc',{method:'POST',body:JSON.stringify({a:a,t:t,p:p})}).then(function(r){return r.json();}).then(ok,fail); } }; return o; }
    window.google={script:{run:{withSuccessHandler:function(f){return mk().withSuccessHandler(f);},withFailureHandler:function(f){return mk().withFailureHandler(f);}}}}; })();
  </script>`;
  return html.replace('<div id="app">', shim2 + '<div id="app">');
}
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      const { a, t, p } = JSON.parse(b);
      vm.runInContext('__x=null', ctx);
      ctx.__a = a; ctx.__t = t; ctx.__p = p;
      const out = run('JSON.stringify(api(__a, __t, __p))');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out);
    });
  } else if (req.url === '/admin-pw') { res.end('Admin@12345'); }
  else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page()); }
}).listen(8765, () => origLog('listening'));
